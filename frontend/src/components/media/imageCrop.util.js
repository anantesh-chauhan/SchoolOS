const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getRadianAngle = (degreeValue) => (degreeValue * Math.PI) / 180;

export const getCroppedFile = async (imageSrc, croppedAreaPixels, fileName = 'cropped.jpg') => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(0));
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(
    image,
    safeArea / 2 - image.width / 2,
    safeArea / 2 - image.height / 2
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;

  ctx.putImageData(
    data,
    0 - safeArea / 2 + image.width / 2 - croppedAreaPixels.x,
    0 - safeArea / 2 + image.height / 2 - croppedAreaPixels.y
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (file) => {
        if (!file) {
          reject(new Error('Canvas is empty'));
          return;
        }

        resolve(new File([file], fileName, { type: file.type }));
      },
      'image/jpeg',
      0.92
    );
  });
};
