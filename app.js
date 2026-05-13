const CONTRACT_ABI = [
  "function requestInference(string prompt) payable returns (uint256 requestId)",
  "function latestResult(uint256 requestId) view returns (address requester, string prompt, bytes output, bool fulfilled)",
  "event InferenceRequested(uint256 indexed requestId, address indexed requester, string prompt)",
  "event InferenceFulfilled(uint256 indexed requestId, bytes output)"
];

const state = {
  provider: null,
  signer: null,
  account: null,
  chainId: null
};

const els = {
  menuToggle: document.querySelector("#menuToggle"),
  mainMenu: document.querySelector("#mainMenu"),
  connectWallet: document.querySelector("#connectWallet"),
  walletStatus: document.querySelector("#walletStatus"),
  networkStatus: document.querySelector("#networkStatus"),
  accountStatus: document.querySelector("#accountStatus"),
  requestForm: document.querySelector("#requestForm"),
  contractAddress: document.querySelector("#contractAddress"),
  prompt: document.querySelector("#prompt"),
  sendRequest: document.querySelector("#sendRequest"),
  readResult: document.querySelector("#readResult"),
  requestId: document.querySelector("#requestId"),
  txLink: document.querySelector("#txLink"),
  output: document.querySelector("#output")
};

function setMenuOpen(isOpen) {
  document.body.classList.toggle("menu-open", isOpen);
  els.menuToggle?.setAttribute("aria-expanded", String(isOpen));
}

function requireWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask atau wallet EIP-1193 belum terpasang.");
  }
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerTxUrl(chainId, hash) {
  const explorers = {
    1: "https://etherscan.io/tx/",
    11155111: "https://sepolia.etherscan.io/tx/",
    84532: "https://sepolia.basescan.org/tx/"
  };
  return explorers[Number(chainId)] ? `${explorers[Number(chainId)]}${hash}` : "#";
}

function setBusy(isBusy) {
  els.sendRequest.disabled = isBusy;
  els.readResult.disabled = isBusy;
  els.connectWallet.disabled = isBusy;
}

async function connectWallet() {
  requireWallet();

  state.provider = new ethers.BrowserProvider(window.ethereum);
  state.signer = await state.provider.getSigner();
  state.account = await state.signer.getAddress();

  const network = await state.provider.getNetwork();
  state.chainId = Number(network.chainId);

  els.walletStatus.textContent = "Terhubung";
  els.networkStatus.textContent = `${network.name || "Unknown"} (${state.chainId})`;
  els.accountStatus.textContent = shortAddress(state.account);
  els.connectWallet.textContent = "Wallet connected";
}

function getContract() {
  if (!state.signer) {
    throw new Error("Connect wallet dulu.");
  }
  const address = els.contractAddress.value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error("Alamat contract tidak valid.");
  }
  return new ethers.Contract(address, CONTRACT_ABI, state.signer);
}

async function sendInferenceRequest(event) {
  event.preventDefault();
  setBusy(true);
  els.output.textContent = "Mengirim transaksi...";

  try {
    const contract = getContract();
    const prompt = els.prompt.value.trim();
    const tx = await contract.requestInference(prompt);
    els.txLink.textContent = tx.hash;
    els.txLink.href = explorerTxUrl(state.chainId, tx.hash);

    const receipt = await tx.wait();
    const iface = new ethers.Interface(CONTRACT_ABI);
    const requested = receipt.logs
      .map((log) => {
        try {
          return iface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "InferenceRequested");

    if (requested) {
      const requestId = requested.args.requestId.toString();
      els.requestId.value = requestId;
      els.output.textContent = `Request #${requestId} terkirim. Tunggu node Infernet memenuhi callback, lalu klik "Baca hasil".`;
      return;
    }

    els.output.textContent = "Transaksi berhasil, tapi event request tidak ditemukan di receipt.";
  } catch (error) {
    els.output.textContent = error.shortMessage || error.message;
  } finally {
    setBusy(false);
  }
}

async function readResult() {
  setBusy(true);
  els.output.textContent = "Membaca hasil...";

  try {
    const contract = getContract();
    const requestId = BigInt(els.requestId.value.trim());
    const result = await contract.latestResult(requestId);
    const decodedOutput = ethers.toUtf8String(result.output);

    els.output.textContent = JSON.stringify(
      {
        requester: result.requester,
        prompt: result.prompt,
        fulfilled: result.fulfilled,
        output: decodedOutput
      },
      null,
      2
    );
  } catch (error) {
    els.output.textContent = error.shortMessage || error.message;
  } finally {
    setBusy(false);
  }
}

els.connectWallet.addEventListener("click", () => {
  connectWallet().catch((error) => {
    els.output.textContent = error.message;
  });
});
els.menuToggle?.addEventListener("click", () => {
  setMenuOpen(!document.body.classList.contains("menu-open"));
});
els.mainMenu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    setMenuOpen(false);
  }
});
els.requestForm.addEventListener("submit", sendInferenceRequest);
els.readResult.addEventListener("click", readResult);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
