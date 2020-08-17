const cache = require('../../util/cache');
const Pool = require('../../util/pool');
const Element = require('../element');

const pool = new Pool();

class HTMLCanvasElement extends Element {
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

    return new HTMLCanvasElement(options, tree);
  }

  /**
     * 覆写父类的 $$init 方法
     */
  $$init(options, tree) {
    const { width } = options;
    const { height } = options;

    if (typeof width === 'number' && width >= 0) options.attrs.width = width;
    if (typeof height === 'number' && height >= 0) options.attrs.height = height;

    super.$$init(options, tree);

    this.$_node = null;

    this.$_initRect();
  }

  /**
     * 覆写父类的回收实例方法
     */
  $$recycle() {
    this.$$destroy();

    // 复用 element 节点
    pool.add(this);
  }

  /**
     * 准备 canvas 节点
     */
  $$prepare() {
    return new Promise((resolve, reject) => {
      this.$$getNodesRef().then(nodesRef => nodesRef.node((res) => {
        this.$_node = res.node;

        // 设置 canvas 宽高
        this.$_node.width = this.width;
        this.$_node.height = this.height;

        resolve(this);
      }).exec())
        .catch(reject);
    });
  }

  get $$node() {
    return this.$_node;
  }

  /**
     * 更新父组件树
     */
  $_triggerParentUpdate() {
    this.$_initRect();
    super.$_triggerParentUpdate();
  }

  /**
     * 初始化长宽
     */
  $_initRect() {
    const width = parseInt(this.$_attrs.get('width'), 10);
    const height = parseInt(this.$_attrs.get('height'), 10);

    if (typeof width === 'number' && width >= 0) {
      this.$_style.width = `${width}px`;
    }
    if (typeof height === 'number' && height >= 0) {
      this.$_style.height = `${height}px`;
    }
  }

  /**
     * 对外属性和方法
     */
  get width() {
    if (this.$_node) return this.$_node.width;
    return +this.$_attrs.get('width') || 0;
  }

  set width(value) {
    if (typeof value !== 'number' || !isFinite(value) || value < 0) return;

    if (this.$_node) this.$_node.width = value;
    else this.$_attrs.set('width', value);
  }

  get height() {
    if (this.$_node) return this.$_node.height;
    return +this.$_attrs.get('height') || 0;
  }

  set height(value) {
    if (typeof value !== 'number' || !isFinite(value) || value < 0) return;

    if (this.$_node) this.$_node.height = value;
    else this.$_attrs.set('height', value);
  }

  getContext(type) {
    if (!this.$_node) {
      console.warn('canvas is not prepared, please call $$prepare method first');
      return;
    }
    return this.$_node.getContext(type);
  }
}

module.exports = HTMLCanvasElement;
