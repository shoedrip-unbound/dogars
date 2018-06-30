import { task, src, symlink } from "gulp";

task("default",
    () => src(['templates', 'public', 'settings.json'])
        .pipe(symlink("dist")));

// gulp is actually garbage