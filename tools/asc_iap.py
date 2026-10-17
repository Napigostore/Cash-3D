"""Creates (or updates) the Cash to Freedom PRO in-app purchase in App Store Connect: a non-consumable with
English and Vietnamese texts, a US$4.99 base price, availability everywhere and a review screenshot.

Run by the "listing" job: ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… python3 tools/asc_iap.py ios/fastlane/iap/pro.png
Every step tolerates "already done". A failure is reported as a warning so the app itself can still ship:
the game hides PRO while the App Store does not offer the product.
"""
import hashlib
import json
import sys
import urllib.error
import urllib.request

import asc_listing as asc

PRODUCT_ID = 'com.cashtofreedom.app.pro'
PRICE_USD = '4.99'
TEXTS = {
    'en-US': ('Cash to Freedom PRO', 'Expert advisor, VIP life, post-game reviews'),
    'vi': ('Cash to Freedom PRO', 'Chuyên gia tư vấn, sống VIP, tổng kết ván'),
}
REVIEW_NOTE = ('Non-consumable upgrade. Open the crown button at the top right of the game (or the Free time tile) to see the PRO '
               'sheet with Buy and Restore. PRO makes the in-game advisor unlimited with deeper analysis, unlocks the post-game '
               'review, and gives a small in-game advantage (starting Luck and Happiness +10).')


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
    print('::warning title=PRO in-app purchase::' + message.replace('%', '%25').replace('\n', '%0A'))


def main(screenshot):
    app_id = req('GET', f'/v1/apps?filter[bundleId]={asc.BUNDLE_ID}')['data'][0]['id']
    found = req('GET', f'/v1/apps/{app_id}/inAppPurchasesV2?filter[productId]={PRODUCT_ID}&limit=1')['data']
    if found:
        iap = found[0]
        print('PRO exists:', iap['attributes'].get('state'))
    else:
        iap = req('POST', '/v2/inAppPurchases', {'data': {'type': 'inAppPurchases', 'attributes': {
            'name': 'Cash to Freedom PRO', 'productId': PRODUCT_ID, 'inAppPurchaseType': 'NON_CONSUMABLE',
            'reviewNote': REVIEW_NOTE, 'familySharable': True},
            'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})['data']
        print('PRO created')
    iap_id = iap['id']

    # names and descriptions
    locs = req('GET', f'/v2/inAppPurchases/{iap_id}/inAppPurchaseLocalizations')['data']
    for locale, (name, desc) in TEXTS.items():
        have = next((l for l in locs if l['attributes']['locale'] == locale), None)
        if have:
            req('PATCH', f'/v1/inAppPurchaseLocalizations/{have["id"]}', {'data': {'type': 'inAppPurchaseLocalizations', 'id': have['id'],
                'attributes': {'name': name, 'description': desc}}}, allow=(409,))
        else:
            req('POST', '/v1/inAppPurchaseLocalizations', {'data': {'type': 'inAppPurchaseLocalizations', 'attributes': {'locale': locale, 'name': name, 'description': desc},
                'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': iap_id}}}}}, allow=(409,))
    print('texts set')

    # price: US$4.99 as the base, other territories follow Apple's equalisation
    points, path = [], f'/v2/inAppPurchases/{iap_id}/pricePoints?filter[territory]=USA&limit=200'
    while path:
        page = req('GET', path)
        points += page['data']
        nxt = page.get('links', {}).get('next')
        path = nxt.replace(asc.API, '') if nxt else None
    point = next((x for x in points if x['attributes'].get('customerPrice') == PRICE_USD), None)
    if point:
        req('POST', '/v1/inAppPurchasePriceSchedules', {'data': {'type': 'inAppPurchasePriceSchedules', 'relationships': {
            'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': iap_id}},
            'baseTerritory': {'data': {'type': 'territories', 'id': 'USA'}},
            'manualPrices': {'data': [{'type': 'inAppPurchasePrices', 'id': '${price0}'}]}}},
            'included': [{'type': 'inAppPurchasePrices', 'id': '${price0}', 'attributes': {'startDate': None},
                          'relationships': {'inAppPurchasePricePoint': {'data': {'type': 'inAppPurchasePricePoints', 'id': point['id']}}}}]}, allow=(409,))
        print('price set: US$' + PRICE_USD)
    else:
        warn(f'No US${PRICE_USD} price point found; set the price in App Store Connect.')

    # available in every territory
    territories, path = [], '/v1/territories?limit=200'
    while path:
        page = req('GET', path)
        territories += [{'type': 'territories', 'id': t['id']} for t in page['data']]
        nxt = page.get('links', {}).get('next')
        path = nxt.replace(asc.API, '') if nxt else None
    req('POST', '/v1/inAppPurchaseAvailabilities', {'data': {'type': 'inAppPurchaseAvailabilities', 'attributes': {'availableInNewTerritories': True},
        'relationships': {'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': iap_id}}, 'availableTerritories': {'data': territories}}}}, allow=(409,))
    print(f'available in {len(territories)} territories')

    # review screenshot (the PRO sheet in the game)
    data = open(screenshot, 'rb').read()
    old = req('GET', f'/v2/inAppPurchases/{iap_id}/appStoreReviewScreenshot', allow=(404,))
    if old and old.get('data'):
        req('DELETE', f'/v1/inAppPurchaseAppStoreReviewScreenshots/{old["data"]["id"]}', allow=(404, 409))
    shot = req('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {'data': {'type': 'inAppPurchaseAppStoreReviewScreenshots',
        'attributes': {'fileName': 'pro.png', 'fileSize': len(data)},
        'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': iap_id}}}}})['data']
    for op in shot['attributes']['uploadOperations']:
        part = data[op['offset']:op['offset'] + op['length']]
        headers = {h['name']: h['value'] for h in op.get('requestHeaders', [])}
        urllib.request.urlopen(urllib.request.Request(op['url'], data=part, method=op['method'], headers=headers), timeout=300).read()
    req('PATCH', f'/v1/inAppPurchaseAppStoreReviewScreenshots/{shot["id"]}', {'data': {'type': 'inAppPurchaseAppStoreReviewScreenshots', 'id': shot['id'],
        'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    print('review screenshot uploaded')
    state = req('GET', f'/v2/inAppPurchases/{iap_id}')['data']['attributes'].get('state')
    print('::notice title=PRO in-app purchase::Cash to Freedom PRO is ' + str(state))


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except Exception as e:  # the app ships either way; PRO stays hidden until the product exists
        warn(str(e)[-1500:])
