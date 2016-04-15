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

import Colors from 'material-ui/lib/styles/colors';
import Spacing from 'material-ui/lib/styles/spacing';
import Typography from 'material-ui/lib/styles/typography';
import zIndex from 'material-ui/lib/styles/zIndex';


/**
 * HTM Studio: Material-UI Theme
 */
export default {
  fontFamily: 'Roboto, sans-serif',
  spacing: Spacing,
  zIndex,
  palette: {
    primary1Color: '#29aae2', // numenta blue : actions
    primary1FadeColor: '#b7d5e2', // faded numenta blue
    primary2Color: '#095c80', // darkened numenta blue : header
    primary3Color: Colors.lightBlack,
    accent1Color: '#29aae2', // numenta blue : actions
    accent2Color: Colors.lightBlue800,
    accent3Color: Colors.grey500, // neutral gray for small menu headings
    accent4Color: Colors.grey700, // slightly less dark than textColor Black
    textColor: Colors.darkBlack, // main text color
    alternateTextColor: Colors.white,
    canvasColor: Colors.white,
    borderColor: Colors.grey300,
    disabledColor: Colors.grey300, // disabled light gray
    dangerColor: '#cb0000',  // Numenta Anomaly Red
    warnColor: '#d6ce03',  // Numenta Anomaly Yellow
    safeColor: '#0f8300'  // Numenta Anomaly Green
  },
  font: {
    weight: {
      light: Typography.fontWeightLight,
      normal: Typography.fontWeightNormal,
      medium: Typography.fontWeightMedium
    }
  }
};
