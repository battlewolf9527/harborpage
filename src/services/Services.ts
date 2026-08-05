import AuthService from './AuthService';
import DataManager from './DataManager';
import ConfigService from './ConfigService';
import IconManager from './IconManager';

export interface Services {
  authService: typeof AuthService;
  dataManager: typeof DataManager;
  configService: typeof ConfigService;
  iconManager: typeof IconManager;
}