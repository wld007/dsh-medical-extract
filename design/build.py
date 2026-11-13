"""Build design mockups: inject the dsh-medical-event client CSS (prefix me- -> mx-) into *.src.html,
then render PNGs (dark + light) with headless Chrome.

    python3 design/build.py
"""
import pathlib, re, subprocess

HERE = pathlib.Path(__file__).resolve().parent
EVENT_CLIENT = HERE.parent.parent / 'dsh-medical-event' / 'client.js'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

src = EVENT_CLIENT.read_text(encoding='utf-8')
css = re.search(r'const CSS = `(.*?)`\n', src, re.S).group(1)
css = re.sub(r'\bme-', 'mx-', css)
css = re.sub(r'\.me\b', '.mx', css)

for page in sorted(HERE.glob('*.src.html')):
    out = page.with_name(page.name.replace('.src.html', '.html'))
    out.write_text(page.read_text(encoding='utf-8').replace('/*__CSS__*/', css), encoding='utf-8')
    for theme in ('dark', 'light'):
        png = out.with_name(f'{out.stem}-{theme}.png')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                        '--window-size=1600,1130', '--virtual-time-budget=1500', f'--screenshot={png}',
                        f'{out.as_uri()}#{theme}'], check=True, capture_output=True)
        print(png)
