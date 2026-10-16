/**
 * BioSurg AR v3.0 - 4K Ultra-HD Screenshot Capture Engine
 * Captures 6 high-resolution 3840x2160 screenshots for Hackathon Devpost submission
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const PORT = 8089;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

// MIME types for static server
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url || '/';
      if (reqPath === '/' || reqPath.startsWith('/?')) reqPath = '/index.html';
      const cleanPath = reqPath.split('?')[0];
      const filePath = path.join(DIST_DIR, cleanPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(PORT, () => {
      console.log(`[StaticServer] Serving ${DIST_DIR} at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function capture() {
  const server = await startServer();

  console.log('[Puppeteer] Launching Edge headless browser at 3840x2160 (4K UHD)...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--enable-webgl',
      '--enable-features=Vulkan,DefaultANGLEVulkan',
      '--window-size=3840,2160'
    ],
    defaultViewport: {
      width: 3840,
      height: 2160,
      deviceScaleFactor: 1
    }
  });

  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });
  console.log('[Puppeteer] Page loaded successfully.');

  const shots = [
    {
      file: '01_nir_hypoxia_heatmap_4k.png',
      name: 'Hyperspectral NIR Hypoxia Heatmap',
      action: async () => {
        // Toggle NIR on, set camera to NIR preset
        await page.evaluate(() => {
          const nirBtn = document.getElementById('btn-toggle-nir');
          if (nirBtn && !nirBtn.classList.contains('primary')) nirBtn.click();
          const nirCamBtn = document.querySelector('[data-cam="NIR"]') as HTMLButtonElement;
          nirCamBtn?.click();
        });
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    {
      file: '02_microtremor_holographic_cone_4k.png',
      name: 'AI Micro-Tremor Stabilization & 25-Deg Holographic Vector Cone',
      action: async () => {
        await page.evaluate(() => {
          const povCamBtn = document.querySelector('[data-cam="SURGEON"]') as HTMLButtonElement;
          povCamBtn?.click();
          const slider = document.getElementById('slider-cannula-depth') as HTMLInputElement;
          if (slider) {
            slider.value = '2.10';
            slider.dispatchEvent(new Event('input'));
          }
        });
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    {
      file: '03_exploded_tissue_layers_4k.png',
      name: 'Quad-Layer Dynamic Exploded View (+18mm Separation)',
      action: async () => {
        await page.evaluate(() => {
          const expBtn = document.getElementById('btn-toggle-exploded');
          if (expBtn && !expBtn.classList.contains('primary')) expBtn.click();
          const overviewCamBtn = document.querySelector('[data-cam="OVERVIEW"]') as HTMLButtonElement;
          overviewCamBtn?.click();
        });
        await new Promise((r) => setTimeout(r, 1500));
      }
    },
    {
      file: '04_specs_waveguide_hud_radar_4k.png',
      name: 'Snap SPECS Optical Waveguide HUD & Diagnostics Matrix',
      action: async () => {
        await page.evaluate(() => {
          const povCamBtn = document.querySelector('[data-cam="SURGEON"]') as HTMLButtonElement;
          povCamBtn?.click();
          const slider = document.getElementById('slider-cannula-depth') as HTMLInputElement;
          if (slider) {
            slider.value = '3.50';
            slider.dispatchEvent(new Event('input'));
          }
        });
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    {
      file: '05_endovascular_lumen_entry_4k.png',
      name: 'Endovascular Lumen Entry (4.2mm Target Penetration)',
      action: async () => {
        await page.evaluate(() => {
          const crossCamBtn = document.querySelector('[data-cam="CROSS"]') as HTMLButtonElement;
          crossCamBtn?.click();
          const slider = document.getElementById('slider-cannula-depth') as HTMLInputElement;
          if (slider) {
            slider.value = '4.20';
            slider.dispatchEvent(new Event('input'));
          }
        });
        await new Promise((r) => setTimeout(r, 1400));
      }
    },
    {
      file: '06_leaf_14_verification_matrix_4k.png',
      name: '14/14 LEAF Matrix & Quantum SHA-256 DICOM Audit Ledger',
      action: async () => {
        await page.evaluate(() => {
          const exportBtn = document.getElementById('btn-export-dicom');
          exportBtn?.click();
        });
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  ];

  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  const devpostDir = path.resolve(process.cwd(), 'assets/devpost');

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    console.log(`[Capture ${i + 1}/6] Capturing ${s.name}...`);
    await s.action();

    const targetPath1 = path.join(screenshotsDir, s.file);
    const targetPath2 = path.join(devpostDir, s.file);

    await page.screenshot({ path: targetPath1, type: 'png' });
    fs.copyFileSync(targetPath1, targetPath2);
    console.log(`  -> Saved: ${targetPath1}`);
  }

  await browser.close();
  server.close();
  console.log('[Puppeteer] All 6 4K Ultra-HD screenshots successfully captured and saved!');
}

capture().catch((err) => {
  console.error('[Error] Screenshot capture failed:', err);
  process.exit(1);
});
