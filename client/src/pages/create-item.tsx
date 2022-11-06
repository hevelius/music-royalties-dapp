import React, { FormEvent } from "react";
import type { NextPage } from "next";
import { VStack, Heading } from "@chakra-ui/layout";
import { Button, Image, Input, Textarea } from "@chakra-ui/react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import { nftAddress, nftMarketAddress } from "../utils/constants";
import axios from "axios";
import { NFT__factory as NFT } from "backend/typechain-types";
import { NFTMarket__factory as Market } from "backend/typechain-types";

declare let window: any;

const CreateItem: NextPage = () => {
  const [fileUrl, setFileUrl] = React.useState("");
  const [coverImage, setCoverImage] = React.useState<FileList>();
  const [audioFile, setAudioFile] = React.useState<FileList>();
  const [formInput, updateFormInput] = React.useState({
    price: "",
    name: "",
    description: "",
    creator: "",
    feeRoyalties: "",
  });
  const [awaitingConfirmation, setAwaitingConfirmation] = React.useState(0);
  const router = useRouter();

  const onChange = async (e: FormEvent) => {
    const { target } = e;
    const { files } = target as HTMLInputElement;
    const file = files ? files[0] : null;
    console.log(file);
    if (file !== null) {
      //const client = create({ host: 'localhost', port: 5001, protocol: 'http' });
      //const added = await client.add('hello world');
      //console.log(added);
      //const url = `https://localhost/ipfs/${added.path}`;
      //setFileUrl(url);
      //console.log(url);
    }
  };

  const createMarket = async () => {
    const { name, description, price } = formInput;
    console.log(formInput);
    if (!name || !description || !price) return;

    /* first, upload to IPFS */
    const data = JSON.stringify({
      name,
      description,
    });

    const formData = new FormData();
    formData.append("data", data);
    if (coverImage) {
      formData.append("cover", coverImage[0]);
    }
    if (audioFile) {
      formData.append("audio", audioFile[0]);
    }
    axios
      .post("http://127.0.0.1:5000/uploader", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      })
      .then(function (response) {
        console.log(response);
        const url = `https://ipfs.io/ipfs/${response.data}`;
        createSale(url);
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const createSale = async (url: string) => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    /* next, create the item */
    let contract = new ethers.Contract(nftAddress, NFT.abi, signer);
    let transaction = await contract.createToken(url);
    setAwaitingConfirmation(1);
    let tx = await transaction.wait();
    console.log(tx);
    let event = tx.events[0];
    console.log(event);
    let value = event.args[2];
    let tokenId = value.toNumber();
    const price = ethers.utils.parseUnits(formInput.price, "ether");

    /* then list the item for sale on the marketplace */
    contract = new ethers.Contract(nftMarketAddress, Market.abi, signer);

    transaction = await contract.createMarketItem(
      nftAddress,
      tokenId,
      price,
      formInput.creator,
      formInput.feeRoyalties,
    );
    setAwaitingConfirmation(2);
    await transaction.wait();
    router.push("/");
  };

  return (
    <>
      <Heading as="h4" size="md">
        Create new item
      </Heading>
      <VStack>
        <Input
          placeholder="Asset Name"
          onChange={(e) =>
            updateFormInput({ ...formInput, name: e.target.value })
          }
        />
        <Textarea
          placeholder="Asset Description"
          onChange={(e) =>
            updateFormInput({ ...formInput, description: e.target.value })
          }
        />
        <Input
          placeholder="Asset Price in wei"
          onChange={(e) =>
            updateFormInput({ ...formInput, price: e.target.value })
          }
        />
        <Input
          placeholder="Royalties receiver"
          onChange={(e) =>
            updateFormInput({ ...formInput, creator: e.target.value })
          }
        />
        <Input
          placeholder="Royalty fee"
          onChange={(e) =>
            updateFormInput({ ...formInput, feeRoyalties: e.target.value })
          }
        />
        <Input
          type="file"
          name="Cover image"
          accept="image/png, image/gif, image/jpeg"
          size="md"
          onChange={(e) => setCoverImage(e.target.files as FileList)}
        />
        <Input
          type="file"
          name="Audio file"
          accept="audio/*"
          size="md"
          onChange={(e) => setAudioFile(e.target.files as FileList)}
        />
        {fileUrl && <Image src={fileUrl} alt={"file to upload"} />}
        <Button onClick={createMarket}>Create and List NFT</Button>
        <p> Transaction {awaitingConfirmation} of 2 processing... </p>
      </VStack>
    </>
  );
};

export default CreateItem;