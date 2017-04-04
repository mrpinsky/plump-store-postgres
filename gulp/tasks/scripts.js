const gulp = require('gulp');
const config = require('../config');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');

function build() {
  const tsProject = ts.createProject('tsconfig.json');
  return tsProject.src()
  .pipe(sourcemaps.init())
  .pipe(tsProject())
  .js
  .pipe(sourcemaps.write())
  .pipe(gulp.dest(config.dest));
}

gulp.task('build', build);

module.exports = build;
