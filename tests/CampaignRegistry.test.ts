import { describe, it, expect, beforeEach } from "vitest";
import { asciiToBytes } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_TITLE = 101;
const ERR_INVALID_DESCRIPTION = 102;
const ERR_INVALID_DISASTER_TYPE = 103;
const ERR_INVALID_LOCATION = 104;
const ERR_INVALID_TARGET_AMOUNT = 105;
const ERR_CAMPAIGN_ALREADY_EXISTS = 106;
const ERR_CAMPAIGN_NOT_FOUND = 107;
const ERR_INVALID_START_TIME = 110;
const ERR_INVALID_END_TIME = 111;
const ERR_INVALID_CAMPAIGN_TYPE = 115;
const ERR_INVALID_CURRENCY = 116;
const ERR_INVALID_MIN_DONATION = 118;
const ERR_INVALID_MAX_AID = 119;
const ERR_INVALID_GOAL = 120;
const ERR_MAX_CAMPAIGNS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 109;

interface Campaign {
  title: string;
  description: string;
  disasterType: string;
  location: string;
  targetAmount: number;
  startTime: number;
  endTime: number;
  timestamp: number;
  owner: string;
  campaignType: string;
  currency: string;
  status: boolean;
  minDonation: number;
  maxAid: number;
  goal: number;
}

interface CampaignUpdate {
  updateTitle: string;
  updateDescription: string;
  updateTargetAmount: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class CampaignRegistryMock {
  state: {
    nextCampaignId: number;
    maxCampaigns: number;
    creationFee: number;
    authorityContract: string | null;
    campaigns: Map<number, Campaign>;
    campaignUpdates: Map<number, CampaignUpdate>;
    campaignsByTitle: Map<string, number>;
  } = {
    nextCampaignId: 0,
    maxCampaigns: 1000,
    creationFee: 1000,
    authorityContract: null,
    campaigns: new Map(),
    campaignUpdates: new Map(),
    campaignsByTitle: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextCampaignId: 0,
      maxCampaigns: 1000,
      creationFee: 1000,
      authorityContract: null,
      campaigns: new Map(),
      campaignUpdates: new Map(),
      campaignsByTitle: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  setMaxCampaigns(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxCampaigns = newMax;
    return { ok: true, value: true };
  }

  createCampaign(
    title: string,
    description: string,
    disasterType: string,
    location: string,
    targetAmount: number,
    startTime: number,
    endTime: number,
    campaignType: string,
    currency: string,
    minDonation: number,
    maxAid: number,
    goal: number
  ): Result<number> {
    if (this.state.nextCampaignId >= this.state.maxCampaigns) return { ok: false, value: ERR_MAX_CAMPAIGNS_EXCEEDED };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!["earthquake", "flood", "hurricane", "wildfire"].includes(disasterType)) return { ok: false, value: ERR_INVALID_DISASTER_TYPE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (targetAmount <= 0) return { ok: false, value: ERR_INVALID_TARGET_AMOUNT };
    if (startTime < this.blockHeight) return { ok: false, value: ERR_INVALID_START_TIME };
    if (endTime <= startTime) return { ok: false, value: ERR_INVALID_END_TIME };
    if (!["emergency", "recovery", "prevention"].includes(campaignType)) return { ok: false, value: ERR_INVALID_CAMPAIGN_TYPE };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minDonation <= 0) return { ok: false, value: ERR_INVALID_MIN_DONATION };
    if (maxAid <= 0) return { ok: false, value: ERR_INVALID_MAX_AID };
    if (goal <= 0) return { ok: false, value: ERR_INVALID_GOAL };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.campaignsByTitle.has(title)) return { ok: false, value: ERR_CAMPAIGN_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextCampaignId;
    const campaign: Campaign = {
      title,
      description,
      disasterType,
      location,
      targetAmount,
      startTime,
      endTime,
      timestamp: this.blockHeight,
      owner: this.caller,
      campaignType,
      currency,
      status: true,
      minDonation,
      maxAid,
      goal,
    };
    this.state.campaigns.set(id, campaign);
    this.state.campaignsByTitle.set(title, id);
    this.state.nextCampaignId++;
    return { ok: true, value: id };
  }

  getCampaign(id: number): Campaign | null {
    return this.state.campaigns.get(id) || null;
  }

  updateCampaign(id: number, updateTitle: string, updateDescription: string, updateTargetAmount: number): Result<boolean> {
    const campaign = this.state.campaigns.get(id);
    if (!campaign) return { ok: false, value: false };
    if (campaign.owner !== this.caller) return { ok: false, value: false };
    if (!updateTitle || updateTitle.length > 100) return { ok: false, value: false };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: false };
    if (updateTargetAmount <= 0) return { ok: false, value: false };
    if (this.state.campaignsByTitle.has(updateTitle) && this.state.campaignsByTitle.get(updateTitle) !== id) {
      return { ok: false, value: false };
    }

    const updated: Campaign = {
      ...campaign,
      title: updateTitle,
      description: updateDescription,
      targetAmount: updateTargetAmount,
      timestamp: this.blockHeight,
    };
    this.state.campaigns.set(id, updated);
    this.state.campaignsByTitle.delete(campaign.title);
    this.state.campaignsByTitle.set(updateTitle, id);
    this.state.campaignUpdates.set(id, {
      updateTitle,
      updateDescription,
      updateTargetAmount,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  deactivateCampaign(id: number): Result<boolean> {
    const campaign = this.state.campaigns.get(id);
    if (!campaign) return { ok: false, value: false };
    if (this.caller !== campaign.owner) return { ok: false, value: false };
    this.state.campaigns.set(id, { ...campaign, status: false });
    return { ok: true, value: true };
  }

  getCampaignCount(): Result<number> {
    return { ok: true, value: this.state.nextCampaignId };
  }

  checkCampaignExistence(title: string): Result<boolean> {
    return { ok: true, value: this.state.campaignsByTitle.has(title) };
  }
}

describe("CampaignRegistry", () => {
  let contract: CampaignRegistryMock;

  beforeEach(() => {
    contract = new CampaignRegistryMock();
    contract.reset();
  });

  it("creates a campaign successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createCampaign(
      "Earthquake Relief",
      "Aid for earthquake victims",
      "earthquake",
      "City A",
      100000,
      100,
      200,
      "emergency",
      "STX",
      10,
      50000,
      100000
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const campaign = contract.getCampaign(0);
    expect(campaign?.title).toBe("Earthquake Relief");
    expect(campaign?.description).toBe("Aid for earthquake victims");
    expect(campaign?.disasterType).toBe("earthquake");
    expect(campaign?.location).toBe("City A");
    expect(campaign?.targetAmount).toBe(100000);
    expect(campaign?.startTime).toBe(100);
    expect(campaign?.endTime).toBe(200);
    expect(campaign?.campaignType).toBe("emergency");
    expect(campaign?.currency).toBe("STX");
    expect(campaign?.minDonation).toBe(10);
    expect(campaign?.maxAid).toBe(50000);
    expect(campaign?.goal).toBe(100000);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate campaign titles", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "Flood Aid",
      "Help for flood areas",
      "flood",
      "Region B",
      50000,
      50,
      150,
      "recovery",
      "USD",
      5,
      25000,
      50000
    );
    const result = contract.createCampaign(
      "Flood Aid",
      "Another description",
      "flood",
      "Region C",
      60000,
      60,
      160,
      "prevention",
      "BTC",
      6,
      30000,
      60000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_CAMPAIGN_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.createCampaign(
      "Hurricane Relief",
      "Support for hurricane victims",
      "hurricane",
      "Coast D",
      200000,
      200,
      300,
      "emergency",
      "STX",
      20,
      100000,
      200000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects campaign creation without authority contract", () => {
    const result = contract.createCampaign(
      "Wildfire Aid",
      "Fire recovery",
      "wildfire",
      "Forest E",
      150000,
      150,
      250,
      "recovery",
      "STX",
      15,
      75000,
      150000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid disaster type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createCampaign(
      "Invalid Disaster",
      "Description",
      "tornado",
      "Area F",
      100000,
      100,
      200,
      "emergency",
      "STX",
      10,
      50000,
      100000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DISASTER_TYPE);
  });

  it("rejects invalid start time", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.blockHeight = 100;
    const result = contract.createCampaign(
      "Past Start",
      "Description",
      "earthquake",
      "City G",
      100000,
      50,
      150,
      "emergency",
      "STX",
      10,
      50000,
      100000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_START_TIME);
  });

  it("rejects invalid end time", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createCampaign(
      "Invalid End",
      "Description",
      "flood",
      "Region H",
      100000,
      100,
      50,
      "recovery",
      "USD",
      10,
      50000,
      100000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_END_TIME);
  });

  it("updates a campaign successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "Old Campaign",
      "Old Desc",
      "earthquake",
      "City I",
      100000,
      100,
      200,
      "emergency",
      "STX",
      10,
      50000,
      100000
    );
    const result = contract.updateCampaign(0, "New Campaign", "New Desc", 150000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const campaign = contract.getCampaign(0);
    expect(campaign?.title).toBe("New Campaign");
    expect(campaign?.description).toBe("New Desc");
    expect(campaign?.targetAmount).toBe(150000);
    const update = contract.state.campaignUpdates.get(0);
    expect(update?.updateTitle).toBe("New Campaign");
    expect(update?.updateDescription).toBe("New Desc");
    expect(update?.updateTargetAmount).toBe(150000);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent campaign", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateCampaign(99, "New Title", "New Desc", 150000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "Test Campaign",
      "Test Desc",
      "flood",
      "Region J",
      100000,
      100,
      200,
      "recovery",
      "USD",
      10,
      50000,
      100000
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateCampaign(0, "New Title", "New Desc", 150000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("deactivates a campaign successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "Active Campaign",
      "Active Desc",
      "hurricane",
      "Coast K",
      200000,
      200,
      300,
      "emergency",
      "STX",
      20,
      100000,
      200000
    );
    const result = contract.deactivateCampaign(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const campaign = contract.getCampaign(0);
    expect(campaign?.status).toBe(false);
  });

  it("rejects deactivation for non-existent campaign", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.deactivateCampaign(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects deactivation by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "To Deactivate",
      "Desc",
      "wildfire",
      "Forest L",
      150000,
      150,
      250,
      "recovery",
      "BTC",
      15,
      75000,
      150000
    );
    contract.caller = "ST4FAKE";
    const result = contract.deactivateCampaign(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(2000);
    contract.createCampaign(
      "Fee Test",
      "Desc",
      "earthquake",
      "City M",
      100000,
      100,
      200,
      "emergency",
      "STX",
      10,
      50000,
      100000
    );
    expect(contract.stxTransfers).toEqual([{ amount: 2000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority", () => {
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets max campaigns successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setMaxCampaigns(500);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxCampaigns).toBe(500);
  });

  it("rejects max campaigns change without authority", () => {
    const result = contract.setMaxCampaigns(500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct campaign count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "Campaign 1",
      "Desc 1",
      "flood",
      "Region N",
      50000,
      50,
      150,
      "recovery",
      "USD",
      5,
      25000,
      50000
    );
    contract.createCampaign(
      "Campaign 2",
      "Desc 2",
      "hurricane",
      "Coast O",
      200000,
      200,
      300,
      "emergency",
      "STX",
      20,
      100000,
      200000
    );
    const result = contract.getCampaignCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks campaign existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaign(
      "Existent Campaign",
      "Desc",
      "wildfire",
      "Forest P",
      150000,
      150,
      250,
      "prevention",
      "BTC",
      15,
      75000,
      150000
    );
    const result = contract.checkCampaignExistence("Existent Campaign");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkCampaignExistence("Non Existent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects campaign creation with empty title", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createCampaign(
      "",
      "Desc",
      "earthquake",
      "City Q",
      100000,
      100,
      200,
      "emergency",
      "STX",
      10,
      50000,
      100000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects campaign creation with max campaigns exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxCampaigns = 1;
    contract.createCampaign(
      "Campaign Max 1",
      "Desc 1",
      "flood",
      "Region R",
      50000,
      50,
      150,
      "recovery",
      "USD",
      5,
      25000,
      50000
    );
    const result = contract.createCampaign(
      "Campaign Max 2",
      "Desc 2",
      "hurricane",
      "Coast S",
      200000,
      200,
      300,
      "emergency",
      "STX",
      20,
      100000,
      200000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_CAMPAIGNS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});