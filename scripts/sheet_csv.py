"""Download one tab of a private Google Sheet as CSV.

Usage: python3 scripts/sheet_csv.py <sheet id> <gid> <output.csv>
Needs GOOGLE_TOKEN in the environment: a short-lived access token from
google-github-actions/auth (keyless Workload Identity Federation). The Sheet
must be shared with the service account as Viewer.
"""
import csv, json, os, sys, time, urllib.parse, urllib.request

API = 'https://sheets.googleapis.com/v4/spreadsheets/'

def get(url):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['GOOGLE_TOKEN']})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                sys.exit(f'Sheets API {e.code}: is the Sheet shared with the service account? {e.read()[:300]!r}')
            if attempt == 3: raise
        except urllib.error.URLError:
            if attempt == 3: raise
        time.sleep(5 * (attempt + 1))

def main(sheet_id, gid, out):
    meta = get(API + sheet_id + '?fields=sheets.properties(sheetId,title)')
    titles = {str(s['properties']['sheetId']): s['properties']['title'] for s in meta['sheets']}
    if str(gid) not in titles:
        sys.exit(f'No tab with gid {gid}')
    rng = urllib.parse.quote("'" + titles[str(gid)].replace("'", "''") + "'", safe='')
    rows = get(API + sheet_id + '/values/' + rng + '?valueRenderOption=FORMATTED_VALUE').get('values', [])
    width = max((len(r) for r in rows), default=0)
    with open(out, 'w', newline='', encoding='utf-8') as f:
        csv.writer(f).writerows([r + [''] * (width - len(r)) for r in rows])
    print(f'{out}: {len(rows)} rows from tab "{titles[str(gid)]}"')

if __name__ == '__main__':
    main(*sys.argv[1:4])
