import { ConfigManager } from "./Ms.Ess.Release.Task.Core/configManager";
import { GatewayCaller } from './Ms.Ess.Release.Task.Core/gatewayCaller';
import { ExceptionMessages } from './Ms.Ess.Release.Task.Common/exceptionMessages';
import { Constant } from './Ms.Ess.Release.Task.Common/constants';
import http = require('http');
import { MSEssGatewayClientContractsOperationResponse, MSEssGatewayClientContractsReleaseResponseReleaseDetailsMessage } from "./Ms.Ess.Release.Task.Common/api";

export async function run(this: any) {

    try {
        
        var configManager = new ConfigManager();
        await configManager.PopulateConfiguration().then(() => {

            console.log(Constant.ConfigPopulatingSuccess);
        }).catch((error: any) => {

            console.log(ExceptionMessages.ConfigCreationFailed);
            throw error;
        });

        var gatewayCommunicator = new GatewayCaller(configManager.config!);
        let operationId = "";
        await gatewayCommunicator.GatewayCalling().then((responseId: string) => {

            operationId = responseId;
        }).catch ((error: any) => {

            console.log(ExceptionMessages.GatewayCallingExecutionFailed);
            var finalError = new Error();
            try {

                let err = error as { response: http.IncomingMessage; body: MSEssGatewayClientContractsOperationResponse; };
                finalError = new Error(err.response.statusCode + '--' + err.response.statusMessage);
            }
            catch (er) {

                throw error;
            }
            throw finalError;
        });
        await gatewayCommunicator.GatewayPolling(operationId).then().catch((error: any) => {

            console.log(ExceptionMessages.GatewayPollingExecutionFailed);
            var finalError = new Error();
            try {

                let err = error as { response: http.IncomingMessage; body: MSEssGatewayClientContractsReleaseResponseReleaseDetailsMessage };
                finalError = new Error(err.response.statusCode + '--' + err.response.statusMessage);
            }
            catch (er) {

                throw error;
            }
            throw finalError;
        });

    }
    catch (error) {

        console.log(ExceptionMessages.ExecutionFailed);
        try {

            let err = error as Error;
            console.log(err.message);
        }
        catch (er) {

            console.log(error);
        }
    }
}

run();