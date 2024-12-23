const fs = require('fs');
const path = require('path');
const Track = require('../models/Track');
const NodeID3 = require('node-id3');

const musicPath = path.join(__dirname, '../../public/music/tracks');
const coversPath = path.join(__dirname, '../../public/music/covers');

const loadLocalMusic = async () => {
  try {
    console.log('Reading music directory:', musicPath);
    const files = fs.readdirSync(musicPath);
    console.log(`Found ${files.length} files`);

    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.mp3') {
        const filePath = path.join(musicPath, file);

        try {
          const exists = await Track.findOne({
            fileUrl: `/music/tracks/${file}`
          });

          if (!exists) {
            const tags = NodeID3.read(filePath);
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            const durationInSeconds = Math.floor(fileSizeInBytes / (128 * 1024 / 8));

            const trackMetadata = {
              title: tags.title || path.parse(file).name,
              artist: tags.artist,
              album: tags.album,
              duration: durationInSeconds,
              fileUrl: `/music/tracks/${file}`,
              coverArt: tags.image ? `/music/covers/${path.parse(file).name}.jpg` : 'default-cover.jpg',
              genre: tags.genre
            };

            const track = await Track.createLocalTrack(trackMetadata, process.env.DEV_USER_ID);
            console.log(`Added track: ${track.title}`);
          } else {
            console.log(`Track already exists: ${file}`);
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error.message);
          continue;
        }
      }
    }

    console.log('Music loading complete');
  } catch (error) {
    console.error('Error loading music:', error.message);
    throw error;
  }
};

module.exports = loadLocalMusic;