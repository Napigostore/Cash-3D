"""Creates (or updates) the Cash to Freedom PRO products in App Store Connect:
  - subscription group "Cash to Freedom PRO" with a monthly (US$1.99) and a yearly (US$9.99) auto-renewable plan,
    no free trial, prices equalised for every territory;
  - a lifetime non-consumable (US$19.99).
Each gets English and Vietnamese texts, availability everywhere and a review screenshot.

Run by the "listing" job: ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… python3 tools/asc_pro.py ios/fastlane/iap/pro.png
Every step tolerates "already done". A failure is reported as a warning so the app itself can still ship:
the game hides PRO (and keeps the Prosperity Track open) while the App Store does not offer the products.
"""
import hashlib
import json
import sys
import urllib.error
import urllib.request

import asc_listing as asc

GROUP = 'Cash to Freedom PRO'
LIFETIME = ('com.cashtofreedom.app.pro', '19.99', {'en-US': ('PRO Lifetime', 'Prosperity Track, expert advisor, VIP life'),
                                                   'vi': ('PRO trọn đời', 'Vòng Thịnh Vượng, chuyên gia, sống VIP')})
PLANS = [  # product id, period, US price, group level (1 = highest), texts
    ('com.cashtofreedom.app.pro.monthly', 'ONE_MONTH', '1.99', 2,
     {'en-US': ('PRO Monthly', 'Prosperity Track and expert advisor'), 'vi': ('PRO theo tháng', 'Vòng Thịnh Vượng và chuyên gia')}),
    ('com.cashtofreedom.app.pro.yearly', 'ONE_YEAR', '9.99', 1,
     {'en-US': ('PRO Yearly', 'Prosperity Track and expert advisor'), 'vi': ('PRO theo năm', 'Vòng Thịnh Vượng và chuyên gia')}),
]
REVIEW_NOTE = ('PRO unlocks round 2 (the Prosperity Track), makes the in-game advisor unlimited with deeper analysis, unlocks the '
               'post-game review and gives a small in-game advantage (starting Luck and Happiness +10). The purchase sheet opens from '
               'the crown button at the top right, the Free time tile, or when a player reaches financial freedom. It has Restore.')


def req(method, path, body=None, allow=()):
    request = urllib.request.Request(asc.API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': 'Bearer ' + asc.token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        errors = json.loads(e.read() or b'{}').get('errors', [])
        text = '; '.join(f"{x.get('title', '')}: {x.get('detail', '')}" for x in errors)
        if e.code in allow:
            print(f'  ({method} {path.split("?")[0]}: {e.code} {text}; continuing)')
            return None
        raise RuntimeError(f'{method} {path.split("?")[0]} -> {e.code} {text}')


def warn(message):
    print('::warning title=PRO products::' + message.replace('%', '%25').replace('\n', '%0A'))


def note(message):
    print('::notice title=PRO products::' + message.replace('%', '%25').replace('\n', '%0A'))


def pages(path):
    out = []
    while path:
        page = req('GET', path)
        out += page['data']
        nxt = page.get('links', {}).get('next')
        path = nxt.replace(asc.API, '') if nxt else None
    return out


def upload(kind, rel, owner_type, owner_id, data):
    shot = req('POST', f'/v1/{kind}', {'data': {'type': kind, 'attributes': {'fileName': 'pro.png', 'fileSize': len(data)},
               'relationships': {rel: {'data': {'type': owner_type, 'id': owner_id}}}}})['data']
    for op in shot['attributes']['uploadOperations']:
        part = data[op['offset']:op['offset'] + op['length']]
        headers = {h['name']: h['value'] for h in op.get('requestHeaders', [])}
        urllib.request.urlopen(urllib.request.Request(op['url'], data=part, method=op['method'], headers=headers), timeout=300).read()
    req('PATCH', f'/v1/{kind}/{shot["id"]}', {'data': {'type': kind, 'id': shot['id'],
        'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})


def subscriptions(app_id, territories, data):
    groups = req('GET', f'/v1/apps/{app_id}/subscriptionGroups')['data']
    group = next((g for g in groups if g['attributes'].get('referenceName') == GROUP), None)
    if not group:
        group = req('POST', '/v1/subscriptionGroups', {'data': {'type': 'subscriptionGroups', 'attributes': {'referenceName': GROUP},
                    'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})['data']
        print('subscription group created')
    gid = group['id']
    glocs = req('GET', f'/v1/subscriptionGroups/{gid}/subscriptionGroupLocalizations')['data']
    for locale in ('en-US', 'vi'):
        if not any(l['attributes']['locale'] == locale for l in glocs):
            req('POST', '/v1/subscriptionGroupLocalizations', {'data': {'type': 'subscriptionGroupLocalizations', 'attributes': {'locale': locale, 'name': GROUP},
                'relationships': {'subscriptionGroup': {'data': {'type': 'subscriptionGroups', 'id': gid}}}}}, allow=(409,))
    existing = req('GET', f'/v1/subscriptionGroups/{gid}/subscriptions?limit=50')['data']
    for pid, period, usd, level, texts in PLANS:
        sub = next((x for x in existing if x['attributes'].get('productId') == pid), None)
        if not sub:
            sub = req('POST', '/v1/subscriptions', {'data': {'type': 'subscriptions', 'attributes': {'name': texts['en-US'][0], 'productId': pid,
                      'subscriptionPeriod': period, 'groupLevel': level, 'reviewNote': REVIEW_NOTE, 'familySharable': True},
                      'relationships': {'group': {'data': {'type': 'subscriptionGroups', 'id': gid}}}}})['data']
            print(pid, 'created')
        sid = sub['id']
        locs = req('GET', f'/v1/subscriptions/{sid}/subscriptionLocalizations')['data']
        for locale, (name, desc) in texts.items():
            have = next((l for l in locs if l['attributes']['locale'] == locale), None)
            if have:
                req('PATCH', f'/v1/subscriptionLocalizations/{have["id"]}', {'data': {'type': 'subscriptionLocalizations', 'id': have['id'],
                    'attributes': {'name': name, 'description': desc}}}, allow=(409,))
            else:
                req('POST', '/v1/subscriptionLocalizations', {'data': {'type': 'subscriptionLocalizations', 'attributes': {'locale': locale, 'name': name, 'description': desc},
                    'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}}}}}, allow=(409,))
        req('POST', '/v1/subscriptionAvailabilities', {'data': {'type': 'subscriptionAvailabilities', 'attributes': {'availableInNewTerritories': True},
            'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}}, 'availableTerritories': {'data': territories}}}}, allow=(409,))
        if not req('GET', f'/v1/subscriptions/{sid}/prices?limit=1')['data']:
            point = next((x for x in pages(f'/v1/subscriptions/{sid}/pricePoints?filter[territory]=USA&limit=200')
                          if x['attributes'].get('customerPrice') == usd), None)
            if point:
                points = [point['id']] + [x['id'] for x in pages(f'/v1/subscriptionPricePoints/{point["id"]}/equalizations?limit=200')]
                for pp in points:
                    req('POST', '/v1/subscriptionPrices', {'data': {'type': 'subscriptionPrices', 'attributes': {'startDate': None, 'preserveCurrentPrice': False},
                        'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}},
                                          'subscriptionPricePoint': {'data': {'type': 'subscriptionPricePoints', 'id': pp}}}}}, allow=(409,))
                print(pid, f'priced US${usd} in {len(points)} territories')
            else:
                warn(f'No US${usd} price point for {pid}; set it in App Store Connect.')
        old = req('GET', f'/v1/subscriptions/{sid}/appStoreReviewScreenshot', allow=(404,))
        if not (old and old.get('data')):
            upload('subscriptionAppStoreReviewScreenshots', 'subscription', 'subscriptions', sid, data)
        note(f"{pid}: {req('GET', f'/v1/subscriptions/{sid}')['data']['attributes'].get('state')}")


def lifetime(app_id, territories, data):
    pid, usd, texts = LIFETIME
    found = req('GET', f'/v1/apps/{app_id}/inAppPurchasesV2?filter[productId]={pid}&limit=1')['data']
    if found:
        iap = found[0]
    else:
        iap = req('POST', '/v2/inAppPurchases', {'data': {'type': 'inAppPurchases', 'attributes': {
            'name': 'PRO Lifetime', 'productId': pid, 'inAppPurchaseType': 'NON_CONSUMABLE', 'reviewNote': REVIEW_NOTE, 'familySharable': True},
            'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})['data']
        print(pid, 'created')
    iid = iap['id']
    locs = req('GET', f'/v2/inAppPurchases/{iid}/inAppPurchaseLocalizations')['data']
    for locale, (name, desc) in texts.items():
        have = next((l for l in locs if l['attributes']['locale'] == locale), None)
        if have:
            req('PATCH', f'/v1/inAppPurchaseLocalizations/{have["id"]}', {'data': {'type': 'inAppPurchaseLocalizations', 'id': have['id'],
                'attributes': {'name': name, 'description': desc}}}, allow=(409,))
        else:
            req('POST', '/v1/inAppPurchaseLocalizations', {'data': {'type': 'inAppPurchaseLocalizations', 'attributes': {'locale': locale, 'name': name, 'description': desc},
                'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': iid}}}}}, allow=(409,))
    point = next((x for x in pages(f'/v2/inAppPurchases/{iid}/pricePoints?filter[territory]=USA&limit=200')
                  if x['attributes'].get('customerPrice') == usd), None)
    if point:
        req('POST', '/v1/inAppPurchasePriceSchedules', {'data': {'type': 'inAppPurchasePriceSchedules', 'relationships': {
            'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': iid}},
            'baseTerritory': {'data': {'type': 'territories', 'id': 'USA'}},
            'manualPrices': {'data': [{'type': 'inAppPurchasePrices', 'id': '${price0}'}]}}},
            'included': [{'type': 'inAppPurchasePrices', 'id': '${price0}', 'attributes': {'startDate': None},
                          'relationships': {'inAppPurchasePricePoint': {'data': {'type': 'inAppPurchasePricePoints', 'id': point['id']}}}}]}, allow=(409,))
        print(pid, 'priced US$' + usd)
    else:
        warn(f'No US${usd} price point for {pid}; set it in App Store Connect.')
    req('POST', '/v1/inAppPurchaseAvailabilities', {'data': {'type': 'inAppPurchaseAvailabilities', 'attributes': {'availableInNewTerritories': True},
        'relationships': {'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': iid}}, 'availableTerritories': {'data': territories}}}}, allow=(409,))
    old = req('GET', f'/v2/inAppPurchases/{iid}/appStoreReviewScreenshot', allow=(404,))
    if not (old and old.get('data')):
        upload('inAppPurchaseAppStoreReviewScreenshots', 'inAppPurchaseV2', 'inAppPurchases', iid, data)
    note(f"{pid}: {req('GET', f'/v2/inAppPurchases/{iid}')['data']['attributes'].get('state')}")


def main(screenshot):
    app_id = req('GET', f'/v1/apps?filter[bundleId]={asc.BUNDLE_ID}')['data'][0]['id']
    data = open(screenshot, 'rb').read()
    territories = [{'type': 'territories', 'id': t['id']} for t in pages('/v1/territories?limit=200')]
    for step in (subscriptions, lifetime):
        try:
            step(app_id, territories, data)
        except Exception as e:  # the app ships either way
            warn(f'{step.__name__}: {str(e)[-1200:]}')
    # what App Store Connect now holds
    subs = []
    for g in req('GET', f'/v1/apps/{app_id}/subscriptionGroups')['data']:
        subs += [f"{x['attributes'].get('productId')}={x['attributes'].get('state')}"
                 for x in req('GET', f'/v1/subscriptionGroups/{g["id"]}/subscriptions')['data']]
    iaps = [f"{x['attributes'].get('productId')}={x['attributes'].get('state')}"
            for x in req('GET', f'/v1/apps/{app_id}/inAppPurchasesV2?limit=50')['data']]
    note('In App Store Connect: subscriptions ' + (', '.join(subs) or 'none') + ' | in-app purchases ' + (', '.join(iaps) or 'none'))


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except Exception as e:
        warn(str(e)[-1500:])
