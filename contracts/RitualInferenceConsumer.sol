// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal coordinator interface for a Ritual Infernet-style request.
/// Replace this with the exact interface from ritual-net/infernet-sdk for the
/// network version you deploy against.
interface IInfernetCoordinator {
    function request(
        bytes32 containerId,
        bytes calldata input,
        address callback,
        bytes4 callbackSelector
    ) external payable returns (uint256 requestId);
}

contract RitualInferenceConsumer {
    struct InferenceResult {
        address requester;
        string prompt;
        bytes output;
        bool fulfilled;
    }

    address public owner;
    IInfernetCoordinator public coordinator;
    bytes32 public containerId;

    mapping(uint256 requestId => InferenceResult result) public latestResult;

    event CoordinatorUpdated(address indexed coordinator);
    event ContainerUpdated(bytes32 indexed containerId);
    event InferenceRequested(uint256 indexed requestId, address indexed requester, string prompt);
    event InferenceFulfilled(uint256 indexed requestId, bytes output);

    error NotOwner();
    error NotCoordinator();
    error EmptyPrompt();

    constructor(address initialCoordinator, bytes32 initialContainerId) {
        owner = msg.sender;
        coordinator = IInfernetCoordinator(initialCoordinator);
        containerId = initialContainerId;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setCoordinator(address newCoordinator) external onlyOwner {
        coordinator = IInfernetCoordinator(newCoordinator);
        emit CoordinatorUpdated(newCoordinator);
    }

    function setContainerId(bytes32 newContainerId) external onlyOwner {
        containerId = newContainerId;
        emit ContainerUpdated(newContainerId);
    }

    function requestInference(string calldata prompt) external payable returns (uint256 requestId) {
        if (bytes(prompt).length == 0) revert EmptyPrompt();

        bytes memory input = abi.encode(prompt, msg.sender);
        requestId = coordinator.request{value: msg.value}(
            containerId,
            input,
            address(this),
            this.receiveInference.selector
        );

        latestResult[requestId] = InferenceResult({
            requester: msg.sender,
            prompt: prompt,
            output: "",
            fulfilled: false
        });

        emit InferenceRequested(requestId, msg.sender, prompt);
    }

    function receiveInference(uint256 requestId, bytes calldata output) external {
        if (msg.sender != address(coordinator)) revert NotCoordinator();

        InferenceResult storage result = latestResult[requestId];
        result.output = output;
        result.fulfilled = true;

        emit InferenceFulfilled(requestId, output);
    }
}
