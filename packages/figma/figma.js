require('dotenv').config();
const Figma = require('figma-api');
const { mkdirSync, existsSync } = require('fs');
const path = require('path');
const Downloader = require('nodejs-file-downloader');

(async () => {
  const api = new Figma.Api({
    personalAccessToken: process.env.FIGMA_TOKEN,
  });
  try {
    const basePath = path.join(
      process.cwd(),
      'src',
      'components',
      'icon',
      'assets'
    );
    console.info('Fetching icons list');
    const components = await api.getFileComponents('V4eZU3qDgKYPhR4eaTvSwy');
    const files = components.meta.components
      .filter((item) => item.containing_frame.pageName === 'Icon')
      .map((item) => {
        return {
          node_id: item.node_id,
          name: item.name.replace(/(\w.*\/)/, '').trim(),
        };
      });
    const { images } = await api.getImage('V4eZU3qDgKYPhR4eaTvSwy', {
      ids: files.map((item) => item.node_id).join(','),
      format: 'svg',
    });
    const imagesWithNames = Object.keys(images).map((key) => {
      return {
        url: images[key],
        name: files.find((item) => item.node_id === key).name,
      };
    });

    if (!existsSync(basePath)) {
      mkdirSync(basePath);
    }
    console.info('Downloading Icons');
    await Promise.all(
      imagesWithNames.map((item) =>
        new Downloader({
          url: item.url,
          directory: basePath,
          fileName: `${item.name}.svg`, //This will be the file name.
        }).download()
      )
    );
    console.info('\nDone downloading icons');
  } catch (e) {
    console.error(e);
  }
})();
