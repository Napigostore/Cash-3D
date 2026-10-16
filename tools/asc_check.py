"""Checks the App Store Connect API key secrets and the app record before a TestFlight upload.
Prints which part is wrong (key format, key id/issuer, permissions, missing app) as a run annotation.

Run by the "testflight" job: ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… python3 tools/asc_check.py
"""
import json
import os
import re
import urllib.error
import urllib.request

import asc_listing as asc
from asc_listing import fail


def main():
    key_id, issuer, p8 = (os.environ.get(k, '').strip() for k in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8'))
    problems = []
    if not re.fullmatch(r'[A-Z0-9]{10}', key_id):
        problems.append(f'ASC_KEY_ID should be 10 letters/digits (got {len(key_id)} characters)')
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', issuer):
        problems.append(f'ASC_ISSUER_ID should be a UUID like 69a6de7e-…-…-…-… (got {len(issuer)} characters)')
    if '-----BEGIN PRIVATE KEY-----' not in p8 or '-----END PRIVATE KEY-----' not in p8:
        problems.append('ASC_KEY_P8 should be the whole AuthKey_XXXX.p8 file, including the BEGIN and END PRIVATE KEY lines')
    if problems:
        fail('Secrets look wrong: ' + '; '.join(problems))
    try:
        asc.token()
    except Exception as e:
        fail(f'ASC_KEY_P8 is not a valid private key ({e.__class__.__name__}). Paste the .p8 file again, unchanged.')

    request = urllib.request.Request(asc.API + f'/v1/apps?filter[bundleId]={asc.BUNDLE_ID}',
                                     headers={'Authorization': 'Bearer ' + asc.token()})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            apps = json.loads(response.read())['data']
    except urllib.error.HTTPError as e:
        if e.code == 401:
            # Tell an Individual key (not usable for uploads) apart from a mismatched Team key.
            os.environ['ASC_INDIVIDUAL'] = '1'
            asc._token['at'] = 0
            try:
                urllib.request.urlopen(urllib.request.Request(asc.API + '/v1/apps?limit=1', headers={'Authorization': 'Bearer ' + asc.token()}), timeout=60).read()
                fail('This is an Individual API key. Uploads need a Team key: App Store Connect → Users and Access → Integrations → '
                     'App Store Connect API → Team Keys → Generate API Key (Admin), then update ASC_KEY_ID and ASC_KEY_P8.')
            except urllib.error.HTTPError:
                pass
            fail('Apple rejected the API key (401). ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 must all come from the same key '
                 '(App Store Connect → Users and Access → Integrations → Team Keys), and the key must not be revoked.')
        if e.code == 403:
            fail('The API key works but has no access (403). Use a Team key with the Admin or App Manager role.')
        fail(f'App Store Connect answered {e.code}: {e.read()[:300]!r}')
    if not apps:
        fail(f'The key works, but there is no app with bundle id {asc.BUNDLE_ID} in App Store Connect. Create it (My Apps → New App).')
    print(f'OK: API key accepted, app "{apps[0]["attributes"]["name"]}" found for {asc.BUNDLE_ID}.')


if __name__ == '__main__':
    main()
