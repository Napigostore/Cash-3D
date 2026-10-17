"""Uploads the signed Android App Bundle to Google Play (internal testing track) through the Play Developer API.

Run by .github/workflows/android.yml with PLAY_SERVICE_ACCOUNT_JSON set:
    python3 tools/play_publish.py android/app/build/outputs/bundle/release/app-release.aab [track]
A new app that has never been published only accepts draft releases; the script falls back to that.
Needs: pip install google-api-python-client google-auth
"""
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

PACKAGE = 'com.cashtofreedom.app'
NOTES = [{'language': 'vi-VN', 'text': 'Phiên bản mới của Cash to Freedom.'},
         {'language': 'en-US', 'text': 'A new version of Cash to Freedom.'}]


def note(kind, message):
    print(f'::{kind} title=Google Play::' + message.replace('%', '%25').replace('\n', '%0A'))


def service():
    info = json.loads(os.environ['PLAY_SERVICE_ACCOUNT_JSON'])
    creds = service_account.Credentials.from_service_account_info(info, scopes=['https://www.googleapis.com/auth/androidpublisher'])
    return build('androidpublisher', 'v3', credentials=creds, cache_discovery=False)


def publish(svc, aab, track, status):
    edits = svc.edits()
    edit = edits.insert(packageName=PACKAGE, body={}).execute()
    eid = edit['id']
    bundle = edits.bundles().upload(packageName=PACKAGE, editId=eid,
                                    media_body=MediaFileUpload(aab, mimetype='application/octet-stream', resumable=True)).execute()
    code = str(bundle['versionCode'])
    edits.tracks().update(packageName=PACKAGE, editId=eid, track=track,
                          body={'track': track, 'releases': [{'versionCodes': [code], 'status': status, 'releaseNotes': NOTES}]}).execute()
    edits.commit(packageName=PACKAGE, editId=eid).execute()
    return code


def main(aab, track='internal'):
    svc = service()
    try:
        code = publish(svc, aab, track, 'completed')
        note('notice', f'Version {code} released to the {track} track.')
    except HttpError as e:
        if 'draft' in str(e).lower():
            code = publish(svc, aab, track, 'draft')
            note('notice', f'Version {code} uploaded to the {track} track as a draft (the app is not published yet; '
                           f'roll it out from Play Console → Testing → Internal testing).')
        else:
            note('error', f'Upload failed: {e}')
            sys.exit(1)


if __name__ == '__main__':
    main(*sys.argv[1:])
