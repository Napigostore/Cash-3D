"""Creates (or updates) Cash to Freedom PRO on Google Play, matching the App Store products:
  - subscription "pro" with base plans "monthly" (US$1.99) and "yearly" (US$9.99), no free trial,
    prices converted by Google for every region;
  - one-time product "pro_lifetime" (US$19.99).
Google only allows products after a bundle that uses Play Billing has been uploaded (run play_publish.py first).

Run by .github/workflows/android.yml with PLAY_SERVICE_ACCOUNT_JSON set: python3 tools/play_pro.py
"""
from googleapiclient.errors import HttpError

from play_publish import PACKAGE, note, service

TEXTS = {
    'en-US': ('Cash to Freedom PRO', 'Unlocks the Prosperity Track, the expert advisor and the post-game review.'),
    'vi-VN': ('Cash to Freedom PRO', 'Mở khóa Vòng Thịnh Vượng, chuyên gia tư vấn và tổng kết sau ván.'),
}
PLANS = [('monthly', 'P1M', 1, 990_000_000), ('yearly', 'P1Y', 9, 990_000_000)]
LIFETIME = ('pro_lifetime', 19_990_000)  # price in micros of USD


def usd(units, nanos):
    return {'currencyCode': 'USD', 'units': str(units), 'nanos': nanos}


def regional(svc, units, nanos):
    conv = svc.monetization().convertRegionPrices(packageName=PACKAGE, body={'price': usd(units, nanos)}).execute()
    return [{'regionCode': code, 'newSubscriberAvailability': True, 'price': v['price']}
            for code, v in conv.get('convertedRegionPrices', {}).items()]


def subscription(svc):
    subs = svc.monetization().subscriptions()
    listings = [{'languageCode': lang, 'title': title, 'description': desc} for lang, (title, desc) in TEXTS.items()]
    plans = [{'basePlanId': pid, 'autoRenewingBasePlanType': {'billingPeriodDuration': period, 'resubscribeState': 'RESUBSCRIBE_STATE_ACTIVE'},
              'regionalConfigs': regional(svc, units, nanos)} for pid, period, units, nanos in PLANS]
    body = {'packageName': PACKAGE, 'productId': 'pro', 'listings': listings, 'basePlans': plans}
    try:
        subs.get(packageName=PACKAGE, productId='pro').execute()
        print('subscription pro exists')
    except HttpError:
        subs.create(packageName=PACKAGE, productId='pro', regionsVersion_version='2022/02', body=body).execute()
        print('subscription pro created')
    for pid, *_ in PLANS:
        try:
            subs.basePlans().activate(packageName=PACKAGE, productId='pro', basePlanId=pid, body={}).execute()
        except HttpError as e:
            if 'already' not in str(e).lower():
                raise
    state = subs.get(packageName=PACKAGE, productId='pro').execute()
    note('notice', 'Subscription pro: ' + ', '.join(f"{b['basePlanId']}={b.get('state')}" for b in state.get('basePlans', [])))


def lifetime(svc):
    sku, micros = LIFETIME
    body = {'packageName': PACKAGE, 'sku': sku, 'status': 'active', 'purchaseType': 'managedUser', 'defaultLanguage': 'en-US',
            'defaultPrice': {'priceMicros': str(micros), 'currency': 'USD'},
            'listings': {lang: {'title': title.replace('PRO', 'PRO Lifetime'), 'description': desc} for lang, (title, desc) in TEXTS.items()}}
    items = svc.inappproducts()
    try:
        items.get(packageName=PACKAGE, sku=sku).execute()
        items.update(packageName=PACKAGE, sku=sku, autoConvertMissingPrices=True, body=body).execute()
        print(sku, 'updated')
    except HttpError:
        items.insert(packageName=PACKAGE, autoConvertMissingPrices=True, body=body).execute()
        print(sku, 'created')
    note('notice', f'One-time product {sku}: active, US$19.99')


def main():
    svc = service()
    for step in (subscription, lifetime):
        try:
            step(svc)
        except Exception as e:
            note('warning', f'{step.__name__}: {str(e)[-1200:]}')


if __name__ == '__main__':
    main()
