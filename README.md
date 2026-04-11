# Remove Background

**Free AI background removal** — Remove the background from any image instantly. Full HD quality, unlimited, no account required.

**[Use it now → bg.purvanas.fr](https://bg.purvanas.fr)**

A self-hosted, free alternative to remove.bg.

## Features

- **AI-powered** — Uses [rembg](https://github.com/danielgatis/rembg) (U2-Net model) for precise edge detection
- **Full HD** — Original resolution preserved (remove.bg charges for HD)
- **Unlimited** — No daily limits, no watermarks, no account
- **Privacy** — Images are processed server-side and immediately deleted after processing
- **Works on** — Portraits, products, animals, objects, logos

## How it works

1. Upload an image (drag & drop or click)
2. Click "Supprimer le fond"
3. Wait 10-30 seconds (AI processing)
4. Download the PNG with transparent background

## Comparison with remove.bg

| Feature | bg.purvanas.fr | remove.bg |
|---------|---------------|-----------|
| Price | **Free** | Free (low-res) / $1.99+ per HD image |
| HD quality | **Yes, always** | Paid only |
| Daily limit | **None** | 1 free/day (low-res) |
| Account required | **No** | Yes |
| Self-hostable | **Yes** | No |

## Tech Stack

- **Backend**: Node.js, Express
- **AI engine**: [rembg](https://github.com/danielgatis/rembg) (Python, U2-Net)
- **Frontend**: Vanilla HTML/CSS/JS
- **Hosting**: Self-hosted on Ubuntu Server

## Self-hosting

```bash
git clone https://github.com/Purvanas/remove-background.git
cd remove-background
npm install
pip install rembg[cli]
node server.js
```

Requires Python 3 and rembg installed. First run downloads the AI model (~170 MB).

## License

MIT

## Links

- **Live demo**: [bg.purvanas.fr](https://bg.purvanas.fr)
- **Author**: [Purvanas](https://purvanas.fr)
- **Other tools**: [Universal Downloader](https://dl.purvanas.fr) · [Converter](https://convert.purvanas.fr) · [PDF Tools](https://pdf.purvanas.fr) · [QR Generator](https://qr.purvanas.fr) · [FileDrop](https://drop.purvanas.fr)
