"""Submits the iOS version being prepared for App Review, with the newest processed build. Uses the App Store Connect API.

Run by the "submit" job in .github/workflows/ios.yml:
    ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… python3 tools/asc_submit.py 1.0.0
"""
import os
import sys
import time
import urllib.error

import asc_listing as asc
from asc_listing import call, fail


def call_ok(method, path, body=None, allow=()):
    """Like call(), but returns None for the listed "already done" conflicts instead of stopping."""
    request = asc.urllib.request.Request(asc.API + path, method=method, data=asc.json.dumps(body).encode() if body is not None else None,
                                         headers={'Authorization': 'Bearer ' + asc.token(), 'Content-Type': 'application/json'})
    try:
        with asc.urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            return asc.json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        text = asc.describe(e)
        if e.code in allow:
            # Shown as a run annotation: a conflict here can explain a later refusal.
            print(f'::warning title=TestFlight::{method} {path.split("?")[0]}: {e.code} ' + text.replace('\n', '%0A'))
            return None
        fail(f'{method} {path.split("?")[0]} -> {e.code} {text}')


def main(version_string):
    app_id = call('GET', f'/v1/apps?filter[bundleId]={asc.BUNDLE_ID}')['data'][0]['id']
    version = call('GET', f'/v1/apps/{app_id}/appStoreVersions?filter[platform]=IOS&filter[versionString]={version_string}')['data'][0]
    print('version', version_string, version['attributes'].get('appStoreState'))

    # The newest processed build of this version. When this run also uploaded one (MIN_BUILD = its build number),
    # wait for Apple to finish processing it rather than submitting an older build.
    min_build = int(os.environ.get('MIN_BUILD') or 0)
    deadline = time.time() + 75 * 60
    while True:
        builds = call('GET', f'/v1/builds?filter[app]={app_id}&filter[preReleaseVersion.version]={version_string}&sort=-uploadedDate&limit=10')['data']
        fresh = [b for b in builds if int(b['attributes']['version']) >= min_build]
        valid = [b for b in fresh if b['attributes'].get('processingState') == 'VALID']
        if valid:
            build = valid[0]
            break
        bad = [b for b in fresh if b['attributes'].get('processingState') in ('FAILED', 'INVALID')]
        if bad:
            fail(f'Build {bad[0]["attributes"]["version"]} was rejected while processing ({bad[0]["attributes"]["processingState"]}); see App Store Connect → TestFlight')
        if time.time() > deadline:
            fail(f'No processed build {min_build or ""} for {version_string} after 75 minutes; run submit again later')
        states = ', '.join(f'{b["attributes"]["version"]}:{b["attributes"].get("processingState")}' for b in fresh) or 'not uploaded yet'
        print(f'waiting for build ≥ {min_build} to finish processing ({states})', flush=True)
        time.sleep(60)
    call('PATCH', f'/v1/appStoreVersions/{version["id"]}/relationships/build', {'data': {'type': 'builds', 'id': build['id']}})
    print('build', build['attributes']['version'], 'attached')

    # App Review details: no demo login needed (the game is fully playable offline); notes tell the reviewer what to expect.
    detail = call('GET', f'/v1/appStoreVersions/{version["id"]}/appStoreReviewDetail').get('data')
    notes = ('No account is needed to play; progress is stored on the device. Online play is optional: Start screen → '
             '"Play online" → Sign in with Apple (or email), then create a room and add bots; Delete account is in the online lobby. '
             'Tap "Start a new game" (1 player vs 3 bots by default), then "Roll the dice". It is an educational board game about '
             'personal finance: all prices, stocks and companies are fictional simulations, no ads. Round 1 is free; PRO (monthly or yearly auto-renewable subscription, or a lifetime non-consumable) unlocks round 2 and the expert advisor. The purchase sheet opens from the crown button (top right), the Free time tile, or when a player reaches financial freedom; it has Restore and links to the Terms of Use and Privacy Policy. '
             'The app is in English or Vietnamese following the device language; the EN/VI button at the top right switches it.')
    attributes = {'demoAccountRequired': False, 'notes': notes}
    if detail:
        call('PATCH', f'/v1/appStoreReviewDetails/{detail["id"]}', {'data': {'type': 'appStoreReviewDetails', 'id': detail['id'], 'attributes': attributes}})
    else:
        call('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': attributes,
             'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version['id']}}}}})
    print('review details: no sign-in required, notes set')

    # Privacy policy on the app information: URL and a short text, in every language (Apple now asks for both).
    infos = call('GET', f'/v1/apps/{app_id}/appInfos')['data']
    info = next((i for i in infos if i['attributes'].get('appStoreState') != 'READY_FOR_SALE'), infos[0])
    for loc in call('GET', f'/v1/appInfos/{info["id"]}/appInfoLocalizations')['data']:
        vi = loc['attributes']['locale'].startswith('vi')
        url = 'https://napigostore.github.io/Cash-3D/docs/privacy.html' + ('?lang=vi' if vi else '')
        text = (('Chơi offline không cần tài khoản. Khi chọn chơi trực tuyến, chúng tôi lưu tên hiển thị, email, bạn bè và phòng chơi '
                 'trên Firebase để vận hành trận đấu; bạn có thể xóa tài khoản trong game. Thanh toán PRO qua Apple. Chi tiết: ')
                if vi else
                ('Offline play needs no account. If you play online we store your display name, email, friends and game rooms on '
                 'Firebase to run matches; you can delete your account in the game. PRO is paid through Apple. Details: ')) + url
        call_ok('PATCH', f'/v1/appInfoLocalizations/{loc["id"]}', {'data': {'type': 'appInfoLocalizations', 'id': loc['id'],
                'attributes': {'privacyPolicyUrl': url, 'privacyPolicyText': text}}}, allow=(409,))
    print('privacy policy set for', len(infos), 'app info(s)')

    # One review submission for the app, holding the version.
    open_ones = call('GET', f'/v1/apps/{app_id}/reviewSubmissions?filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES')['data']
    if open_ones:
        submission = open_ones[0]
    else:
        submission = call('POST', '/v1/reviewSubmissions', {'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
                          'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})['data']
    items = call('GET', f'/v1/reviewSubmissions/{submission["id"]}/items?include=appStoreVersion')['data']
    has_version = any((i.get('relationships', {}).get('appStoreVersion', {}).get('data') or {}).get('id') == version['id'] for i in items)
    if not has_version:
        call('POST', '/v1/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems', 'relationships': {
            'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': submission['id']}},
            'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version['id']}}}}})
    print('review submission', submission['id'], 'holds the version')

    # PRO products (lifetime, monthly, yearly): the first ones must be reviewed in the same submission as the version,
    # so each one goes in as an item of this submission, not as a separate submission.
    products = [('inAppPurchase', 'inAppPurchases', x) for x in call('GET', f'/v1/apps/{app_id}/inAppPurchasesV2?limit=50')['data']]
    for group in call('GET', f'/v1/apps/{app_id}/subscriptionGroups')['data']:
        products += [('subscription', 'subscriptions', x) for x in call('GET', f'/v1/subscriptionGroups/{group["id"]}/subscriptions')['data']]
    for kind, rtype, prod in products:
        state = prod['attributes'].get('state')
        print(kind, prod['attributes'].get('productId'), state)
        if state in ('READY_TO_SUBMIT', 'DEVELOPER_ACTION_NEEDED', 'REJECTED', 'MISSING_METADATA'):
            call_ok('POST', '/v1/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems', 'relationships': {
                'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': submission['id']}},
                kind: {'data': {'type': rtype, 'id': prod['id']}}}}}, allow=(400, 403, 409, 422))

    call('PATCH', f'/v1/reviewSubmissions/{submission["id"]}', {'data': {'type': 'reviewSubmissions', 'id': submission['id'], 'attributes': {'submitted': True}}})
    print('::notice title=TestFlight::Submitted Cash to Freedom ' + version_string + ' (build ' + build['attributes']['version'] + ') for App Review.')


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except SystemExit:
        raise
    except Exception:
        # Anything unexpected becomes a run annotation, readable without opening the log.
        import traceback
        fail(traceback.format_exc()[-1500:])
