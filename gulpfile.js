let gulp = require("gulp");
let ts = require("gulp-typescript");
let tsProject = ts.createProject("tsconfig.json");

gulp.task("build", function () {
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(gulp.dest("dist"));
});

gulp.task("link", function() {
    return gulp.src(['templates', 'public', 'settings.json'])
        .pipe(gulp.symlink("dist"));
});

gulp.task("default",  gulp.series("build", "link"));

