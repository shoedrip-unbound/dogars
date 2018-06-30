let gulp = require("gulp");

gulp.task("default", function() {
    return gulp.src(['templates', 'public', 'settings.json'])
        .pipe(gulp.symlink("dist"));
});
