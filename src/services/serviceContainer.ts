import type { Services } from './Services';
import AuthService from './AuthService';
import DataManager from './DataManager';
import ConfigService from './ConfigService';
import IconManager from './IconManager';

const defaultServices: Services = {
  authService: AuthService,
  dataManager: DataManager,
  configService: ConfigService,
  iconManager: IconManager,
};

let globalServices: Services = defaultServices;

export const setServices = (services: Services): void => {
  globalServices = services;
};

export const getServices = (): Services => {
  return globalServices;
};
