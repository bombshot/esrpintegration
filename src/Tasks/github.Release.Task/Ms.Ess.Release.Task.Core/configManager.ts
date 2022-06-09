import { IConfig } from '../Ms.Ess.Release.Task.Common/iConfig';
import { Config } from '../Ms.Ess.Release.Task.Common/config';
import { ConfigKeys } from '../Ms.Ess.Release.Task.Common/configKeys';
import { Constant } from '../Ms.Ess.Release.Task.Common/constants';
import path = require('path');
import { KVIdentityConfig } from '../Ms.Ess.Release.Task.Common/keyVaultIdentityConfig';
import { KeyVaultSecret } from '@azure/keyvault-secrets';
import * as keyVaultUtility from '../Ms.Ess.Release.Task.Common/keyVaultUtility'
import { convertPFX } from '../Ms.Ess.Release.Task.Common/certConverter';
import { KeyVaultCertificateWithPolicy } from '@azure/keyvault-certificates';
import { ExceptionMessages } from '../Ms.Ess.Release.Task.Common/exceptionMessages';

export class ConfigManager {

    config: IConfig;

    public constructor(_config?: IConfig) {

        this.config = (_config == undefined) ? new Config() : _config;
    }

    public async PopulateConfiguration() {

        this.setConfigVariables();
        this.SetKVIdentityConfig();
        await this.SetCertificatesInfo().catch((error) => {

            console.log(ExceptionMessages.CertPopulatingError)
            throw error;
        });
    }

    private setConfigVariables() {

        this.config.DomainTenantId = "72f988bf-86f1-41af-91ab-2d7cd011db47";
        this.config.ServiceEndpointUrl = "https://ppe.api.esrp.microsoft.com";
        this.config.AppInsightsLoggingKey = "33e01921-4d64-4f8c-a055-5bdaffd5e33d";
        this.config.MainPublisher = "ESRPRELTEST";
        this.config.Intent = "PackageDistribution";
        this.config.ContentType = "Maven";
        this.config.ContentOrigin = "azeus";
        this.config.ProductState = "new";
        this.config.Audience = "Workflow.A_S_AV_PackageManager";
        this.config.Environment = "Developer";
        this.config.PackageLocation = "src/Tasks/github.Release.Task/pacman-app-1.1";
        this.config.Owners = "arugupta@microsoft.com,vijaisha@microsoft.com";
        this.config.Approvers = "shmallip@microsoft.com,vivaibha@microsoft.com";
        this.config.StatusPollingInterval = Constant.DelayBetweenEveryGetStatus;
        this.config.ConnectedServiceName = "testReleaseServiceConnection";

        if (this.config.ConnectedServiceName == Constant.Bad || this.config.ConnectedServiceName == undefined) {

            throw new Error(ExceptionMessages.BadInputGivenFor + ConfigKeys?.ConnectedServiceName);
        }
    }

    private SetKVIdentityConfig() {

        this.config.KVIdentityConfig = new KVIdentityConfig();
        if (this.config.Environment != undefined && this.config.Environment == Constant.Developer) {

            this.config.KVIdentityConfig.ClientId = process.env["KVAUTHCLIENT"];;
            this.config.KVIdentityConfig.TenantId = "f3cc78a1-7102-45ba-b213-f70a75647125";
            this.config.KVIdentityConfig.KeyVaultName = "esrpgatewaypreprodcred";
            this.config.KVIdentityConfig.AuthCertName = "esrpintegrationppeauthcert";
            this.config.KVIdentityConfig.SignCertName = "esrpintegrationppesigningcert";
            this.config.KVIdentityConfig.ClientSecret = process.env["KVAUTHSECRET"];
        }
        else {

            // try {

                // this.config.KVIdentityConfig.ClientId = tl.getEndpointAuthorizationParameter(this.config.ConnectedServiceName!, ConfigKeys.Username, true)!;
                // this.config.KVIdentityConfig.ClientSecret = tl.getEndpointAuthorizationParameter(this.config.ConnectedServiceName!, ConfigKeys.Password, true)!;
                // this.config.KVIdentityConfig.TenantId = tl.getEndpointAuthorizationParameter(this.config.ConnectedServiceName!, ConfigKeys.TenantId, true)!;
                // this.config.KVIdentityConfig.KeyVaultName = tl.getEndpointAuthorizationParameter(this.config.ConnectedServiceName!, ConfigKeys.KeyVaultName, true)!;
                // this.config.KVIdentityConfig.AuthCertName = tl.getEndpointAuthorizationParameter(this.config.ConnectedServiceName!, ConfigKeys.AuthCertName, true)!;
                // this.config.KVIdentityConfig.SignCertName = tl.getEndpointAuthorizationParameter(this.config.ConnectedServiceName!, ConfigKeys.SignCertName, true)!;

            // }
            // catch (error) {

            //     console.log(ExceptionMessages.KVConfigSetUpError);
            //     throw error;
            // }
        }
        this.config.ClientId = "2460c5ef-b7d2-4f64-be14-bc03d18aa556";
    }

    private async SetCertificatesInfo() {
        
        const authSecretCertificate: KeyVaultSecret = await keyVaultUtility.FetchCertFromSecretClient(this.config.KVIdentityConfig!, this.config.KVIdentityConfig!.AuthCertName!);
        const authCertInfo = convertPFX(authSecretCertificate.value!);
        const authCertificate: KeyVaultCertificateWithPolicy = await keyVaultUtility.FetchCertFromCertificateClient(this.config.KVIdentityConfig!,this.config.KVIdentityConfig!.AuthCertName!);

        var authCer = authCertificate.cer;
        var encodedAuthThumbprint = authCertificate.properties.x509Thumbprint;
        
       this.config.AuthCertThumbprint = Buffer.from(encodedAuthThumbprint!).toString("hex");
       this.config.AuthPublicCert = Buffer.from(authCer!).toString("base64");
       this.config.AuthPrivateKey = authCertInfo.key;

        const signSecretCertificate: KeyVaultSecret = await keyVaultUtility.FetchCertFromSecretClient(this.config.KVIdentityConfig!, this.config.KVIdentityConfig!.SignCertName!);
        const signCertificate: KeyVaultCertificateWithPolicy = await keyVaultUtility.FetchCertFromCertificateClient(this.config.KVIdentityConfig!,this.config.KVIdentityConfig!.SignCertName!);

        const signCertInfo = convertPFX(signSecretCertificate.value!);

        var signCer = signCertificate.cer;
        var encodedSignThumbprint = signCertificate.properties.x509Thumbprint;

       this.config.SignPrivateKey = signCertInfo.key
       this.config.SignPublicCert = Buffer.from(signCer!).toString("base64");
       this.config.SignCertThumbprint = Buffer.from(encodedSignThumbprint!).toString("hex");
    }
}