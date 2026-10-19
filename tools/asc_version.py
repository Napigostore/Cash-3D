"""Creates the app version being prepared in App Store Connect (e.g. 1.0.1) if it does not exist yet.
Run by the "listing" job before tools/asc_listing.py: ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… python3 tools/asc_version.py 1.0.1
Idempotent: an existing version is left alone.
"""
import sys

import asc_listing as asc
from asc_listing import call, fail


def main(version_string):
    app = call('GET', f'/v1/apps?filter[bundleId]={asc.BUNDLE_ID}')['data']
    if not app:
        fail(f'No app with bundle id {asc.BUNDLE_ID} in App Store Connect')
    app_id = app[0]['id']
    existing = call('GET', f'/v1/apps/{app_id}/appStoreVersions?filter[platform]=IOS&filter[versionString]={version_string}')['data']
    if existing:
        print(f'version {version_string} exists ({existing[0]["attributes"].get("appStoreState")})')
        return
    call('POST', '/v1/appStoreVersions', {'data': {'type': 'appStoreVersions', 'attributes': {'platform': 'IOS', 'versionString': version_string,
         'releaseType': 'AFTER_APPROVAL'},
         'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})
    print(f'version {version_string} created')


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except SystemExit:
        raise
    except Exception:
        import traceback
        fail(traceback.format_exc()[-1500:])
