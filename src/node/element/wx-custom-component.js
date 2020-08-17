const cache = require('../../util/cache');
const Pool = require('../../util/pool');
const Element = require('../element');

const pool = new Pool();

class WxCustomComponent extends Element {
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

    return new WxCustomComponent(options, tree);
  }

  /**
     * 覆写父类的 $$init 方法
     */
  $$init(options, tree) {
    this.$_behavior = options.componentName;

    super.$$init(options, tree);
  }

  /**
     * 覆写父类的 $$destroy 方法
     */
  $$destroy() {
    super.$$destroy();

    this.$_behavior = null;
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
    return this.$_behavior;
  }
}

module.exports = WxCustomComponent;
