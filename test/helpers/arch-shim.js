if (process.env.TEST_ARCH) {
    Object.defineProperty(process, 'arch', { value: process.env.TEST_ARCH });
}
