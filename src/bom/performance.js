class Performance {
  constructor(timeOrigin) {
    this.$_timeOrigin = timeOrigin;
  }

  /**
   * 对外属性和方法
   */
  get navigation() {
    return { type: 1, redirectCount: 0 };
  }

  get timing() {
    console.warn('performance.timing is not supported');
    return null;
  }

  get timeOrigin() {
    return this.$_timeOrigin;
  }

  now() {
    return +new Date() - this.$_timeOrigin;
  }
}

module.exports = Performance;
