// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/*Errors*/
error RandomNft__NeedMoreETHToSent();
error RandomNft__AlreadyInitialized();
error RandomNft__RangeOutOfBounds();
error RandomNft__TransferFailed();

/**@title Random NFT hosted on IPFS
 * @notice This contract is for creating randomness NFT
 * @dev This implements the Chainlink VRF Version 2
 */

contract RandomNft is ERC721URIStorage, VRFConsumerBaseV2, Ownable {
    /*Types decleration*/
    enum Breed {
        PUG,
        SHIBA_INU,
        ST_BERNARD
    }
    /*Variables*/
    // Cahinlink VRF
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorVR;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // NFT helper
    mapping(uint256 => address) public s_requestIdToSpnder;

    // NFT variables
    uint256 private immutable i_mintFee;
    uint256 private s_tokenCounter;
    uint256 public constant MAX_CHANCE_VALUE = 100;
    string[] private s_dogTokenUris;
    bool private s_initialized;

    /*Events*/
    event NftRequested(uint256 indexed requestId, address requester);
    event NftMinted(Breed breed, address minter);

    /*Functions*/
    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane,
        uint32 callbackGasLimit,
        uint256 mintFee,
        string[3] memory dogTokenUris
    ) ERC721("Dogie", "DG") VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinatorVR = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_subscriptionId = subscriptionId;
        i_gasLane = gasLane;
        i_callbackGasLimit = callbackGasLimit;
        i_mintFee = mintFee;
        _initializeContract(dogTokenUris);
        s_tokenCounter = 0;
    }

    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) {
            revert RandomNft__NeedMoreETHToSent();
        }
        requestId = i_vrfCoordinatorVR.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        s_requestIdToSpnder[requestId] = msg.sender;
        emit NftRequested(requestId, msg.sender);
    }

    /**
     * @dev This is the function that Chainlink VRF node
     * calls to mint an NFT
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        address dogOwner = s_requestIdToSpnder[requestId];
        uint256 newTokenId = s_tokenCounter;
        s_tokenCounter += s_tokenCounter + 1;
        uint256 moddedRng = randomWords[0] % MAX_CHANCE_VALUE;
        Breed dogBreed = getDogBreedFromModdedRng(moddedRng);
        _safeMint(dogOwner, newTokenId);
        _setTokenURI(newTokenId, s_dogTokenUris[uint256(dogBreed)]);
        emit NftMinted(dogBreed, dogOwner);
    }

    function getChanceArray() public pure returns (uint256[3] memory) {
        return [10, 30, MAX_CHANCE_VALUE];
    }

    function _initializeContract(string[3] memory dogTokenUris) private {
        if (s_initialized) {
            revert RandomNft__AlreadyInitialized();
        }
        s_dogTokenUris = dogTokenUris;
        s_initialized = true;
    }

    function getDogBreedFromModdedRng(
        uint256 moddedRng
    ) public pure returns (Breed) {
        uint256 cumuletiveSum = 0;
        uint256[3] memory chanceArray = getChanceArray();

        for (uint256 i = 0; i < chanceArray.length; i++) {
            // Pug = 0 - 9  (10%)
            // Shiba-inu = 10 - 39  (30%)
            // St. Bernard = 40 = 99 (60%)
            if (moddedRng >= cumuletiveSum && moddedRng < chanceArray[i]) {
                return Breed(i);
            }
            cumuletiveSum += chanceArray[i];
        }
        revert RandomNft__RangeOutOfBounds();
    }

    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert RandomNft__TransferFailed();
        }
    }

    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    function getDogTokenUris(
        uint256 index
    ) public view returns (string memory) {
        return s_dogTokenUris[index];
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }

    function getInitialized() public view returns (bool) {
        return s_initialized;
    }
}
