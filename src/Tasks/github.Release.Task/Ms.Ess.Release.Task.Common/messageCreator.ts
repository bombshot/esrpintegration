import { IMessageCreator } from './iMessageCreator';
import * as GatewayClient from './api';
import * as fs from 'fs';
import { JwtHeader } from 'jsonwebtoken';
import jwt = require('jsonwebtoken');
import path = require('path');
import { IConfig } from './iConfig';
import { Constant } from './constants';
import { IFileUtility } from './iIFileUtility';
import { FileUtility } from './fileUtility';
import { IBlobUtility } from './iBlobUtility';
import { BlobUtility } from './blobUtility';
import xml2js = require('xml2js');
import AdmZip from 'adm-zip';
import { ExceptionMessages } from './exceptionMessages';

export class MessageCreator implements IMessageCreator {

    config: IConfig;
    fileUtility: IFileUtility;
    blobUtility: IBlobUtility;

    public constructor(_config: IConfig, _blobUtility?: IBlobUtility, _fileUtility?: IFileUtility) {

        this.config = _config;
        this.fileUtility = _fileUtility ? _fileUtility : new FileUtility();
        this.blobUtility = _blobUtility ? _blobUtility : new BlobUtility();
    }

    public async PopulateSessionRequestMessage() : Promise<GatewayClient.MSEssGatewayClientContractsSessionRequestMessage> {

        var request = new GatewayClient.MSEssGatewayClientContractsSessionRequestMessage; 
        request.expiresAfter = this.CalculateExpiryAfterTimeFromHours();
        request.partitionCount = Constant.GatewaySessionRequestPartitionCount;
        request.isProvisionStorage = Constant.GatewaySessionRequestIsProvision;
    
        return request;
    }

    private CalculateExpiryAfterTimeFromHours() : string {

        var minutesToAdd = Constant.GatewayBlobExpiryInHours * 60;
        var secondsToAdd = minutesToAdd * 60;
        var validityTime = new Date(secondsToAdd * 1000).toISOString().substr(11, 8);
    
        return validityTime
    }

    private async FetchProductInfo(workFlow: string) : Promise<GatewayClient.MSEssGatewayClientContractsReleaseProductInfo> {

        let productInfo = new GatewayClient.MSEssGatewayClientContractsReleaseProductInfo;

        if(workFlow == Constant.MavenType.toLowerCase()) {

            console.log(Constant.FileContentManipulationStarted);

            let pomFileLocation = this.config.PackageLocation;
            const readDirMain = await fs.promises.readdir(pomFileLocation!);
            let pomFileName = readDirMain.filter(el => path.extname(el) == Constant.PomFileExtension);
            if(pomFileName.length == 0) {

                throw new Error(ExceptionMessages.NoPOMFileExistsError + Constant.PomFileExtension);
            }
            else {

                console.log(Constant.POMFileExists + pomFileName[0] + "\n");
            }

            let pomFileRaw = fs.readFileSync(path.join(pomFileLocation!, pomFileName[0]), "utf8");
            const parser = new xml2js.Parser();
            parser.parseString(pomFileRaw, function(error: any, result: any) {

                if(error === null) {

                    productInfo.name = result[Constant.Project][Constant.ArtifactId][0];
                    productInfo.version = result[Constant.Project][Constant.Version][0];
                    try {

                        productInfo.description = result[Constant.Project][Constant.Description][0];
                    }
                    catch {

                        console.log(Constant.DescriptionMandatoryMessage);
                        productInfo.description = productInfo.name;
                    }
                }
                else {

                    return new Error(error);
                }
            });
        }
        else {

            productInfo.description = Constant.DefaultDescription;
            productInfo.name = Constant.DefaultName;
            productInfo.version = Constant.DefaultVersion;
        }

        return productInfo;
    }

    public async PopulateReleaseRequestMessage(containerSas: URL) : Promise<GatewayClient.MSEssGatewayClientContractsReleaseRequestReleaseRequestMessage> {
    
        var policyFile = fs.readFileSync(path.join(__dirname, Constant.PolicyJsonFilePath)).toString();
        let policyobject : GatewayClient.MSEssGatewayClientContractsRoutingInfo = JSON.parse(policyFile);
    
        var pr = fs.readFileSync(path.join(__dirname, Constant.SubmitReleaseJsonFilePath)).toString();
        let requests: GatewayClient.MSEssGatewayClientContractsReleaseRequestReleaseRequestMessage = JSON.parse(pr);
        requests.esrpCorrelationId = this.config.RequestCorrelationId;
        requests.routingInfo = policyobject;

        requests.routingInfo.contentType = this.config!.ContentType!.toLowerCase();
        requests.routingInfo.intent = this.config!.Intent!.toLowerCase();
        requests.routingInfo.audience = this.config!.Audience?.toLowerCase();
        requests.routingInfo.contentOrigin = this.config!.ContentOrigin?.toLowerCase();
        requests.routingInfo.productState = this.config!.ProductState?.toLowerCase();
        requests.releaseInfo!.properties!.releaseContentType = this.config!.ContentType!.toLowerCase();
    
        let productInfo = await this.FetchProductInfo(this.config!.ContentType!.toLowerCase()).then();
        
        requests.productInfo = productInfo;
        requests.releaseInfo!.title = productInfo.name;
        
        var allOwnersEmail = this.config!.Owners!.split(Constant.Comma);
        allOwnersEmail.forEach(ownerEmail => {

            var userInfo = new GatewayClient.MSEssGatewayClientContractsReleaseUserInfo;
            userInfo.userPrincipalName = ownerEmail;
            var ownerInfo = new GatewayClient.MSEssGatewayClientContractsReleaseOwnerInfo;
            ownerInfo.owner = userInfo;
    
            requests.owners?.push(ownerInfo);
        });
    
        var allApprovalsEmail = this.config!.Approvers!.split(Constant.Comma);
        allApprovalsEmail.forEach(approvalEmail => {

            var userInfo = new GatewayClient.MSEssGatewayClientContractsReleaseUserInfo;
            userInfo.userPrincipalName = approvalEmail;
            var approvalInfo = new GatewayClient.MSEssGatewayClientContractsReleaseApproverInfo;
            approvalInfo.approver = userInfo;
            approvalInfo.isAutoApproved = Constant.DefaultIsAutoApprovedValue;
            approvalInfo.isMandatory = Constant.DefaultIsMandatoryApprovalValue;
    
            requests.approvers?.push(approvalInfo);
        });
    
        requests.accessPermissionsInfo!.mainPublisher = this.config!.MainPublisher;
        requests.createdBy!.userPrincipalName = (requests.owners!)[0].owner?.userPrincipalName;
        
        var localFileLocation = this.config!.PackageLocation;
        
        const zipFileCreator = new AdmZip();
        zipFileCreator.addLocalFolder(localFileLocation!);
        let targetFileName = productInfo.name! + "-" + productInfo.version! + Constant.ZipExtension;
        let targetFileLocation = path.join(localFileLocation!, targetFileName);
        zipFileCreator.writeZip(targetFileLocation);

        var fileInfo = new GatewayClient.MSEssGatewayClientContractsReleaseReleaseFileInfo;
        fileInfo.sourceLocation = new GatewayClient.MSEssGatewayClientContractsFileLocation;
        fileInfo.hashType = GatewayClient.MSEssGatewayClientContractsReleaseReleaseFileInfo.HashTypeEnum.Sha256;
        fileInfo.hash = this.fileUtility.getFile256HashInBase64(targetFileLocation);
        fileInfo.sizeInBytes = this.fileUtility.getFileSizeInBytes(targetFileLocation);

        fileInfo.tenantFileLocationType = Constant.LocationTypeUNC;
        fileInfo.tenantFileLocation = localFileLocation;
        fileInfo.sourceLocation.type = GatewayClient.MSEssGatewayClientContractsFileLocation.TypeEnum.AzureBlob;
    
        let blobSas: URL;

        await this.blobUtility.uploadFileAndGetSas(containerSas, targetFileName, targetFileLocation).then((response) => {

            blobSas = response!;
        }).catch((error) => {

            console.log(ExceptionMessages.FileUploadingAndBlobSASGeneratingError)
            throw error;
        });
    
        fileInfo.sourceLocation.blobUrl = blobSas!.toString();
        fileInfo.name = productInfo.name!;
        fileInfo.friendlyFileName = targetFileName;
        
        requests.files?.push(fileInfo);
        let crit: Array<string> = Constant.TokenHeaderValidationCriteria.split(Constant.Comma);
    
        let tokenValidityTicks = this.CalculateTokenExpiryInTicksFromHours();

        const jWtHeader: JwtHeaderClass = {

            alg: Constant.RSA256Algorithm,
            x5t: this.config!.SignCertThumbprint,
            crit: crit,
            exp:  tokenValidityTicks,
            x5c: this.config!.SignPublicCert
        }
        let signingOptions: jwt.SignOptions = {

            algorithm: 'RS256',
            expiresIn: Constant.JWTTokenExpiryOneHour,
            header: jWtHeader as JwtHeader
        };
        
        const myToken = jwt.sign(requests, this.config!.SignPrivateKey!, signingOptions);
        requests.jwsToken = myToken;
    
        return requests;
    }

    private CalculateTokenExpiryInTicksFromHours() : number {

        const ticksTillDateBaseline = Constant.TicksTill111997; // ticks till 01/01/1970
        var minutesToAdd = Constant.TokenExpiryInHours * 60;
        var tokenValidityDateTime = new Date(Date.now() + minutesToAdd * 60000);
        var tokenValidityNanoseconds = Date.parse(tokenValidityDateTime.toString()) * 10000;
        var tokenValidityTicks = tokenValidityNanoseconds + ticksTillDateBaseline;

        return tokenValidityTicks;
    }
}

class JwtHeaderClass {
    
    alg: string | undefined;
    crit?: string[] | undefined;
    x5t?: string | undefined;
    x5c?: string | string[] | undefined;
    exp?: number | undefined;
}