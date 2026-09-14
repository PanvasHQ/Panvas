import { clip, concatTransformationMatrix, endPath, popGraphicsState, pushGraphicsState, rectangle, type PDFImage, type PDFPage } from 'pdf-lib';
import type { ImageObject } from '../../components/notebook/engine/drawingTypes.ts';
import { getImageCrop, getImageRenderAppearance } from '../../components/notebook/engine/imageAppearance.ts';

/** Clip the unchanged embedded asset in the object's rotated local frame. */
export function drawPdfImage(page: PDFPage, embedded: PDFImage, object: ImageObject, scaleX = 1, scaleY = 1) {
  const crop = getImageCrop(object);
  const appearance = getImageRenderAppearance(object);
  const width = object.width * scaleX, height = object.height * scaleY;
  const angle = -appearance.rotationRadians;
  const cx = (object.x + object.width / 2) * scaleX;
  const cy = page.getHeight() - (object.y + object.height / 2) * scaleY;
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), cx, cy), rectangle(-width / 2, -height / 2, width, height), clip(), endPath());
  page.drawImage(embedded, { x: -width / 2 - crop.x * width / crop.width, y: -height / 2 - (1 - crop.y - crop.height) * height / crop.height, width: width / crop.width, height: height / crop.height, opacity: appearance.opacity });
  page.pushOperators(popGraphicsState());
}
