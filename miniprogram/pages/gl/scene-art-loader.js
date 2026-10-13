let sceneArtPackage = null;

// Share the existing async subpackage mechanism without fetching cloud assets.
export function ensureSceneArtPackage() {
  if (!sceneArtPackage) {
    sceneArtPackage = new Promise((resolve, reject) => {
      require('../../scene-art-assets/ready.js', resolve, reject);
    }).catch(error => { sceneArtPackage = null; throw error; });
  }
  return sceneArtPackage;
}
