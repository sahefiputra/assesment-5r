const gulp = require('gulp');
const fileinclude = require('gulp-file-include');
const browserSync = require('browser-sync').create();

// Task to compile HTML and resolve includes
gulp.task('html', function() {
    return gulp.src(['src/pages/*.html'])
        .pipe(fileinclude({
            prefix: '@@',
            basepath: '@file'
        }))
        .pipe(gulp.dest('dist/'))
        .pipe(browserSync.stream());
});

// Task to copy assets (CSS/JS)
gulp.task('assets', function() {
    return gulp.src(['src/assets/**/*'])
        .pipe(gulp.dest('dist/assets/'))
        .pipe(browserSync.stream());
});

// BrowserSync task
gulp.task('browser-sync', function() {
    browserSync.init({
        server: {
            baseDir: './dist'
        },
        port: 3000,
        open: true
    });
});

// Task to watch for changes
gulp.task('watch', function() {
    gulp.watch(['src/**/*.html'], gulp.series('html'));
    gulp.watch(['src/assets/**/*'], gulp.series('assets'));
});

// Dev task - run build + browser-sync + watch
gulp.task('dev', gulp.series('html', 'assets', gulp.parallel('browser-sync', 'watch')));

// Default task
gulp.task('default', gulp.series('html', 'assets'));
