// Copyright © 2016, Numenta, Inc. Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero Public License version 3 as published by the
// Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program. If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/

import Dygraph from 'dygraphs';


/**
 * Override default pre-draw of Dygraphs RangeSelector background, so we can
 *  customize the styling (remove RangeSelector outline border).
 * @see node_modules/dygraphs/plugins/range-selector.js
 */
Dygraph.Plugins.RangeSelector.prototype.drawStaticLayer_ = function () {
  let margin = 0.5;
  let ctx = this.bgcanvas_ctx_;
  ctx.clearRect(0, 0, this.canvasRect_.w, this.canvasRect_.h);

  try {
    this.drawMiniPlot_();
  } catch (error) {
    throw new Error(error);
  }

  this.bgcanvas_ctx_.lineWidth = 1;
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, this.canvasRect_.h-margin);
  ctx.lineTo(this.canvasRect_.w-margin, this.canvasRect_.h-margin);
  ctx.lineTo(this.canvasRect_.w-margin, margin);
  ctx.stroke();
}

/**
 * Override default draw of Dygraphs RangeSelector handle, so we can customize
 *  the styling.
 * @see node_modules/dygraphs/plugins/range-selector.js
 */
Dygraph.Plugins.RangeSelector.prototype.drawInteractiveLayer_ = function () {
  let ctx = this.fgcanvas_ctx_;
  let margin = 1;
  let width = this.canvasRect_.w - margin;
  let height = this.canvasRect_.h - margin;
  let zoomHandleStatus = this.getZoomHandleStatus_();

  ctx.clearRect(0, 0, this.canvasRect_.w, this.canvasRect_.h);
  ctx.strokeWidth = 1;

  if (!zoomHandleStatus.isZoomed) {
    if (this.iePanOverlay_) {
      this.iePanOverlay_.style.display = 'none';
    }
  } else {
    let leftHandleCanvasPos = Math.max(margin,
          zoomHandleStatus.leftHandlePos - this.canvasRect_.x);
    let rightHandleCanvasPos = Math.min(width,
          zoomHandleStatus.rightHandlePos - this.canvasRect_.x);

    ctx.fillStyle = 'rgba(200, 200, 200, 0.543)';
    ctx.fillRect(0, 0, leftHandleCanvasPos, this.canvasRect_.h);
    ctx.fillRect(rightHandleCanvasPos, 0,
          this.canvasRect_.w - rightHandleCanvasPos, this.canvasRect_.h);

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(75, 75, 75, 0.9)';
    ctx.moveTo(leftHandleCanvasPos, margin);
    ctx.lineTo(leftHandleCanvasPos, height);
    ctx.lineTo(rightHandleCanvasPos, height);
    ctx.lineTo(rightHandleCanvasPos, margin);
    ctx.lineTo(leftHandleCanvasPos, margin);
    ctx.stroke();

    if (this.isUsingExcanvas_) {
      this.iePanOverlay_.style.width =
            `${rightHandleCanvasPos - leftHandleCanvasPos}px`;
      this.iePanOverlay_.style.left = `${leftHandleCanvasPos}px`;
      this.iePanOverlay_.style.height = `${height}px`;
      this.iePanOverlay_.style.display = 'inline';
    }
  }
}
