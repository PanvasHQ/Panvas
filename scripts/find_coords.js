import sharp from 'sharp';

async function checkCardText() {
  const img = sharp('./public/Application SS/CloudSync.png');
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  function getRGB(x, y) {
    const idx = (y * info.width + x) * info.channels;
    return [data[idx], data[idx+1], data[idx+2]];
  }

  console.log('Card fill color at x=1050, y=420:', getRGB(1050, 420));

  for (let y = 380; y <= 520; y += 2) {
    let darkX = [];
    for (let x = 950; x <= 1400; x++) {
      const [r, g, b] = getRGB(x, y);
      if (r < 140 && g < 140 && b < 140) {
        darkX.push(x);
      }
    }
    if (darkX.length > 3) {
      console.log(`y=${y}: text x=${Math.min(...darkX)}..${Math.max(...darkX)} (${darkX.length} px)`);
    }
  }
}

checkCardText();
