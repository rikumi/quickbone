const Event = require('../event/event');
const EventTarget = require('../event/event-target');

class WebSocket extends EventTarget {
  constructor(url, protocols) {
    super();
    this.$_url = url;
    this.$_protocols = protocols;
    this.$_readyState = WebSocket.CONNECTING;
    this.$_socketTask = wx.connectSocket({
      url: this.$_url,
      protocols: this.$_protocols,
    });

    this.$_socketTask.onOpen(this.$_onOpen.bind(this));
    this.$_socketTask.onMessage(this.$_onMessage.bind(this));
    this.$_socketTask.onError(this.$_onError.bind(this));
    this.$_socketTask.onClose(this.$_onClose.bind(this));

    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  $_onOpen() {
    this.$_readyState = WebSocket.OPEN;
    this.onopen && this.onopen();
    this.$$trigger('open');
  }

  $_onMessage({ data }) {
    const event = new Event({
      name: 'message',
      target: this,
      eventPhase: Event.AT_TARGET,
      $$extra: { data },
    });
    this.onmessage && this.onmessage(event);
    this.$$trigger('message', { event });
  }

  $_onError({ errMsg }) {
    const event = new Event({
      name: 'error',
      target: this,
      eventPhase: Event.AT_TARGET,
      $$extra: { message: errMsg },
    });
    this.onerror && this.onerror(event);
    this.$$trigger('error', { event });
  }

  $_onClose({ code, reason }) {
    this.$_readyState = WebSocket.CLOSED;
    const event = new Event({
      name: 'close',
      target: this,
      eventPhase: Event.AT_TARGET,
      $$extra: { code, reason },
    });
    this.onclose && this.onclose(event);
    this.$$trigger('close', { event });
  }

  get readyState() {
    return this.$_readyState;
  }

  get protocols() {
    return this.$_protocols;
  }

  send(data) {
    if (this.$_readyState !== WebSocket.OPEN) {
      throw new Error(`Invalid readyState on WebSocket#send: ${this.$_readyState}`);
    }
    this.$_socketTask.send({ data });
  }

  close(code = 1000, reason) {
    if (this.$_readyState !== WebSocket.OPEN) {
      throw new Error(`Invalid readyState on WebSocket#close: ${this.$_readyState}`);
    }
    this.$_readyState = WebSocket.CLOSING;
    this.$_socketTask.close({ code, reason });
  }
};

WebSocket.CONNECTING = WebSocket.prototype.CONNECTING = 0;
WebSocket.OPEN = WebSocket.prototype.OPEN = 1;
WebSocket.CLOSING = WebSocket.prototype.CLOSING = 2;
WebSocket.CLOSED = WebSocket.prototype.CLOSED = 3;

module.exports = WebSocket;
