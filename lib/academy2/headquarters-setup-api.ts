import {getSetupBankPreference,saveSetupBankPreference} from './setup-bank-preference';
import {getHeadquartersSettings,saveHeadquartersBasic,saveHeadquartersDocument} from './headquarters-settings';
import {getSellerProfile,saveSellerProfile} from './seller-disclosure';
import {getAcademy2OnboardingStatus} from './onboarding';

export const headquartersSetupApi={getBankPreference:getSetupBankPreference,saveBankPreference:saveSetupBankPreference,getSettings:getHeadquartersSettings,saveBasic:saveHeadquartersBasic,saveDocument:saveHeadquartersDocument,getSeller:getSellerProfile,saveSeller:saveSellerProfile,getOnboarding:getAcademy2OnboardingStatus};
export type HeadquartersSetupApi=typeof headquartersSetupApi;
