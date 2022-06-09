import { IConfig } from '../Ms.Ess.Release.Task.Common/iConfig';

export interface IAuthenticationManager {

    accessToken?: string;
    config?: IConfig;

    setAccessToken() : Promise<string | undefined> ;
}