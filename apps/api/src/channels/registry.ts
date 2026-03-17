import { ChannelAdapter } from "./base/channel.adapter";

class ChannelRegistry {
  private adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter) {
    this.adapters.set(adapter.type, adapter);
  }

  get(type: string): ChannelAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) throw new Error(`No adapter registered for channel type: ${type}`);
    return adapter;
  }

  getAll(): ChannelAdapter[] {
    return [...this.adapters.values()];
  }

  getTypes(): string[] {
    return [...this.adapters.keys()];
  }
}

export const registry = new ChannelRegistry();
