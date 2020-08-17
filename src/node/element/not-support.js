const cache = require('../../util/cache');
const Pool = require('../../util/pool');
const Element = require('../element');

const pool = new Pool();

class NotSupport extends Element {
  /**
     * 创建实例
     */
  static $$create(options, tree) {
    // 复用 element 节点
    const instance = pool.get();

    if (instance) {
      instance.$$init(options, tree);
      return instance;
    }

    return new NotSupport(options, tree);
  }

  /**
     * 覆写父类的 $$init 方法
     */
  $$init(options, tree) {
    super.$$init(options, tree);

    // 处理特殊节点
    const { window } = cache[this.$_pageId];
    if (window.onDealWithNotSupportDom) window.onDealWithNotSupportDom(this);
  }

  /**
     * 覆写父类的回收实例方法
     */
  $$recycle() {
    this.$$destroy();

    // 复用 element 节点
    pool.add(this);
  }

  get behavior() {
    return 'not-support';
  }
}

module.exports = NotSupport;
