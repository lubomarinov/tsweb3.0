/**
 * Web3 Mock за тестване
 * Симулира window.ethereum обекта за тестване без истински портфейл
 */

(function() {
  'use strict';

  // Mock адреси за тестване
  const MOCK_ACCOUNTS = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
    '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
  ];

  // Mock chain IDs
  const CHAINS = {
    MAINNET: '0x1',
    GOERLI: '0x5',
    SEPOLIA: '0xaa36a7',
    POLYGON: '0x89',
    LOCALHOST: '0x539'
  };

  // Mock баланси (в wei)
  const MOCK_BALANCES = {
    [MOCK_ACCOUNTS[0]]: '0x56BC75E2D63100000', // 100 ETH
    [MOCK_ACCOUNTS[1]]: '0x1BC16D674EC80000',  // 2 ETH
    [MOCK_ACCOUNTS[2]]: '0x8AC7230489E80000'   // 10 ETH
  };

  // Текущо състояние
  let state = {
    connected: false,
    selectedAddress: null,
    chainId: CHAINS.MAINNET,
    isMetaMask: true
  };

  // Event listeners
  const eventListeners = {
    accountsChanged: [],
    chainChanged: [],
    connect: [],
    disconnect: []
  };

  // Помощна функция за emit на събития
  function emit(eventName, data) {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Event listener error:', e);
        }
      });
    }
  }

  // Mock ethereum обект
  const mockEthereum = {
    isMetaMask: true,
    isConnected: () => state.connected,
    selectedAddress: null,
    chainId: state.chainId,

    // Event handling
    on: function(eventName, callback) {
      if (eventListeners[eventName]) {
        eventListeners[eventName].push(callback);
      }
      return this;
    },

    removeListener: function(eventName, callback) {
      if (eventListeners[eventName]) {
        const index = eventListeners[eventName].indexOf(callback);
        if (index > -1) {
          eventListeners[eventName].splice(index, 1);
        }
      }
      return this;
    },

    // Основен request метод
    request: async function({ method, params }) {
      console.log('[Web3Mock] Request:', method, params);

      // Симулира мрежово закъснение
      await new Promise(resolve => setTimeout(resolve, 100));

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          if (!state.connected && method === 'eth_requestAccounts') {
            // Симулира потребителско одобрение
            state.connected = true;
            state.selectedAddress = MOCK_ACCOUNTS[0];
            mockEthereum.selectedAddress = state.selectedAddress;
            emit('connect', { chainId: state.chainId });
            emit('accountsChanged', [state.selectedAddress]);
          }
          return state.connected ? [state.selectedAddress] : [];

        case 'eth_chainId':
          return state.chainId;

        case 'net_version':
          return parseInt(state.chainId, 16).toString();

        case 'eth_getBalance':
          const address = params[0].toLowerCase();
          const balance = MOCK_BALANCES[address] || '0x0';
          return balance;

        case 'eth_blockNumber':
          return '0x' + Math.floor(Date.now() / 1000).toString(16);

        case 'eth_getTransactionCount':
          return '0x' + Math.floor(Math.random() * 100).toString(16);

        case 'eth_gasPrice':
          return '0x' + (20 * 1e9).toString(16); // 20 Gwei

        case 'eth_estimateGas':
          return '0x5208'; // 21000 gas за прост трансфер

        case 'eth_sendTransaction':
          // Симулира изпращане на транзакция
          const txHash = '0x' + Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');
          console.log('[Web3Mock] Transaction sent:', txHash);
          return txHash;

        case 'eth_call':
          // Връща празен резултат за call
          return '0x';

        case 'eth_getTransactionReceipt':
          // Симулира потвърдена транзакция
          return {
            transactionHash: params[0],
            blockNumber: '0x' + Math.floor(Date.now() / 1000).toString(16),
            blockHash: '0x' + Array.from({ length: 64 }, () =>
              Math.floor(Math.random() * 16).toString(16)
            ).join(''),
            status: '0x1', // успешна транзакция
            gasUsed: '0x5208'
          };

        case 'wallet_switchEthereumChain':
          const newChainId = params[0].chainId;
          state.chainId = newChainId;
          mockEthereum.chainId = newChainId;
          emit('chainChanged', newChainId);
          return null;

        case 'wallet_addEthereumChain':
          console.log('[Web3Mock] Add chain requested:', params[0]);
          return null;

        case 'personal_sign':
          // Симулира подпис
          const signature = '0x' + Array.from({ length: 130 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');
          return signature;

        case 'eth_signTypedData_v4':
          // Симулира EIP-712 подпис
          return '0x' + Array.from({ length: 130 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');

        default:
          console.warn('[Web3Mock] Unsupported method:', method);
          throw new Error(`Method ${method} not supported by mock`);
      }
    },

    // Legacy методи
    enable: async function() {
      return this.request({ method: 'eth_requestAccounts' });
    },

    send: function(method, params) {
      if (typeof method === 'object') {
        return this.request(method);
      }
      return this.request({ method, params });
    },

    sendAsync: function(payload, callback) {
      this.request(payload)
        .then(result => callback(null, { result }))
        .catch(error => callback(error));
    }
  };

  // Помощни функции за тестване
  window.Web3Mock = {
    // Промяна на акаунт
    switchAccount: function(index) {
      if (index >= 0 && index < MOCK_ACCOUNTS.length) {
        state.selectedAddress = MOCK_ACCOUNTS[index];
        mockEthereum.selectedAddress = state.selectedAddress;
        emit('accountsChanged', [state.selectedAddress]);
        console.log('[Web3Mock] Switched to account:', state.selectedAddress);
      }
    },

    // Промяна на мрежа
    switchChain: function(chainId) {
      state.chainId = chainId;
      mockEthereum.chainId = chainId;
      emit('chainChanged', chainId);
      console.log('[Web3Mock] Switched to chain:', chainId);
    },

    // Disconnect
    disconnect: function() {
      state.connected = false;
      state.selectedAddress = null;
      mockEthereum.selectedAddress = null;
      emit('accountsChanged', []);
      emit('disconnect', { code: 1000, message: 'User disconnected' });
      console.log('[Web3Mock] Disconnected');
    },

    // Достъп до mock данни
    accounts: MOCK_ACCOUNTS,
    chains: CHAINS,

    // Добавяне на баланс
    setBalance: function(address, balanceInWei) {
      MOCK_BALANCES[address.toLowerCase()] = balanceInWei;
    },

    // Получаване на текущото състояние
    getState: function() {
      return { ...state };
    }
  };

  // Инжектиране на mock
  if (!window.ethereum) {
    window.ethereum = mockEthereum;
    console.log('[Web3Mock] Mock ethereum injected successfully');
  } else {
    console.warn('[Web3Mock] window.ethereum already exists, not injecting mock');
  }

})();
