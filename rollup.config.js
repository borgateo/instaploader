'use strict';

import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'app/js/app.js',
  format: 'umd',
  moduleName: 'instaploader',
  plugins: [
    json(),
    babel(),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true
    })
  ],
  dest: 'app/bundle.js'
}