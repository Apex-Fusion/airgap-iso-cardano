import { CardanoModule, CARDANO_MAINNET_PROTOCOL_NETWORK, CARDANO_TESTNET_PROTOCOL_NETWORK } from "../index";

// Network switching tests commented out - testnet removed from registry to hide UI
// eslint-disable-next-line jest/no-commented-out-tests
describe.skip("Address Network Switching", () => {
  let module: CardanoModule;

  beforeEach(() => {
    module = new CardanoModule();
  });

  test("should generate mainnet addresses for mainnet protocol", async () => {
    const protocol = await module.createOnlineProtocol("cardano", CARDANO_MAINNET_PROTOCOL_NETWORK);
    expect(protocol).toBeDefined();

    // Generate a test keypair
    const testKeyPair = await (protocol as any).generateKeyPair();
    const address = await protocol!.getAddressFromPublicKey(testKeyPair.publicKey);
    
    // Mainnet addresses start with 'addr1'
    expect(address).toMatch(/^addr1/);
    expect(address).not.toMatch(/^addr_test1/);
  });

  test("should generate testnet addresses for testnet protocol", async () => {
    const protocol = await module.createOnlineProtocol("cardano", CARDANO_TESTNET_PROTOCOL_NETWORK);
    expect(protocol).toBeDefined();

    // Generate a test keypair
    const testKeyPair = await (protocol as any).generateKeyPair();
    const address = await protocol!.getAddressFromPublicKey(testKeyPair.publicKey);
    
    // Testnet addresses start with 'addr_test1'
    expect(address).toMatch(/^addr_test1/);
    expect(address).not.toMatch(/^addr1[^_]/);
  });

  test("should generate different address prefixes for different networks with same key", async () => {
    const mainnetProtocol = await module.createOnlineProtocol("cardano", CARDANO_MAINNET_PROTOCOL_NETWORK);
    const testnetProtocol = await module.createOnlineProtocol("cardano", CARDANO_TESTNET_PROTOCOL_NETWORK);

    // Use the same public key for both
    const testKeyPair = await (mainnetProtocol as any).generateKeyPair();
    
    const mainnetAddress = await mainnetProtocol!.getAddressFromPublicKey(testKeyPair.publicKey);
    const testnetAddress = await testnetProtocol!.getAddressFromPublicKey(testKeyPair.publicKey);
    
    // Should have different prefixes but same key hash
    expect(mainnetAddress).toMatch(/^addr1/);
    expect(testnetAddress).toMatch(/^addr_test1/);
    expect(mainnetAddress).not.toBe(testnetAddress);
  });

  test("should respect network switching via string identifiers", async () => {
    const mainnetProtocol = await module.createOnlineProtocol("cardano", "mainnet");
    const testnetProtocol = await module.createOnlineProtocol("cardano", "testnet");

    const testKeyPair = await (mainnetProtocol as any).generateKeyPair();
    
    const mainnetAddress = await mainnetProtocol!.getAddressFromPublicKey(testKeyPair.publicKey);
    const testnetAddress = await testnetProtocol!.getAddressFromPublicKey(testKeyPair.publicKey);
    
    expect(mainnetAddress).toMatch(/^addr1/);
    expect(testnetAddress).toMatch(/^addr_test1/);
  });

  test("should show correct network in getNetwork() method", async () => {
    const mainnetProtocol = await module.createOnlineProtocol("cardano", "mainnet");
    const testnetProtocol = await module.createOnlineProtocol("cardano", "testnet");

    const mainnetNetwork = await mainnetProtocol!.getNetwork();
    const testnetNetwork = await testnetProtocol!.getNetwork();

    expect(mainnetNetwork.type).toBe("mainnet");
    expect(testnetNetwork.type).toBe("testnet");
    
    expect(mainnetNetwork.name).toBe("Mainnet");
    expect(testnetNetwork.name).toBe("Testnet");
  });
});