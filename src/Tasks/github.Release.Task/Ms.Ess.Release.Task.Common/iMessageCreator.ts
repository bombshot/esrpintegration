import * as GatewayClient from './api'

export interface IMessageCreator {

    PopulateReleaseRequestMessage(containerSas: URL) : Promise<GatewayClient.MSEssGatewayClientContractsReleaseRequestReleaseRequestMessage>;
    PopulateSessionRequestMessage() : Promise<GatewayClient.MSEssGatewayClientContractsSessionRequestMessage>;
}