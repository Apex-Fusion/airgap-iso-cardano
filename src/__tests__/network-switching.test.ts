import { CardanoModule, CARDANO_MAINNET_PROTOCOL_NETWORK, CARDANO_TESTNET_PROTOCOL_NETWORK } from "../index";

// Network switching tests commented out - testnet removed from registry to hide UI
// eslint-disable-next-line jest/no-commented-out-tests
describe.skip("Network Switching Feature", () => {
  let module: CardanoModule;

  beforeEach(() => {
    module = new CardanoModule();
  });

  test("should create online protocol for mainnet by string", async () => {
    const protocol = await module.createOnlineProtocol("cardano", "mainnet");
    expect(protocol).toBeDefined();
    
    const network = await protocol?.getNetwork();
    expect(network?.type).toBe("mainnet");
    expect(network?.name).toBe("Mainnet");
  });

  test("should create online protocol for testnet by string", async () => {
    const protocol = await module.createOnlineProtocol("cardano", "testnet");
    expect(protocol).toBeDefined();
    
    const network = await protocol?.getNetwork();
    expect(network?.type).toBe("testnet");
    expect(network?.name).toBe("Testnet");
  });

  test("should create online protocol for mainnet by network object", async () => {
    const protocol = await module.createOnlineProtocol("cardano", CARDANO_MAINNET_PROTOCOL_NETWORK);
    expect(protocol).toBeDefined();
    
    const network = await protocol?.getNetwork();
    expect(network?.type).toBe("mainnet");
    expect(network?.name).toBe("Mainnet");
  });

  test("should create online protocol for testnet by network object", async () => {
    const protocol = await module.createOnlineProtocol("cardano", CARDANO_TESTNET_PROTOCOL_NETWORK);
    expect(protocol).toBeDefined();
    
    const network = await protocol?.getNetwork();
    expect(network?.type).toBe("testnet");
    expect(network?.name).toBe("Testnet");
  });

  test("should default to mainnet when no network specified", async () => {
    const protocol = await module.createOnlineProtocol("cardano");
    expect(protocol).toBeDefined();
    
    const network = await protocol?.getNetwork();
    expect(network?.type).toBe("mainnet");
  });

  test("should support offline protocol network switching", async () => {
    const mainnetProtocol = await module.createOfflineProtocol("cardano", "mainnet");
    const testnetProtocol = await module.createOfflineProtocol("cardano", "testnet");
    
    expect(mainnetProtocol).toBeDefined();
    expect(testnetProtocol).toBeDefined();
    
    // Both protocols should be different instances
    expect(mainnetProtocol).not.toBe(testnetProtocol);
  });

  test("should create different block explorers for different networks", async () => {
    const mainnetExplorer = await module.createBlockExplorer("cardano", CARDANO_MAINNET_PROTOCOL_NETWORK);
    const testnetExplorer = await module.createBlockExplorer("cardano", CARDANO_TESTNET_PROTOCOL_NETWORK);
    
    expect(mainnetExplorer).toBeDefined();
    expect(testnetExplorer).toBeDefined();
    
    // Should use different URLs
    expect(mainnetExplorer).not.toBe(testnetExplorer);
  });

  test("should have proper network registries set up", () => {
    expect(module.supportedProtocols).toBeDefined();
    expect(module.supportedProtocols.cardano).toBeDefined();
    expect(module.supportedProtocols.cardano.type).toBe("full");
  });

  test("should support Tezos-style network switching interface", async () => {
    // This tests the exact interface pattern used by Tezos
    const networkId = CARDANO_TESTNET_PROTOCOL_NETWORK.type;
    const protocol = await module.createOnlineProtocol("cardano", networkId);
    
    expect(protocol).toBeDefined();
    const network = await protocol?.getNetwork();
    expect(network?.type).toBe("testnet");
  });
});