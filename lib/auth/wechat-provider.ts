import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers/index';

export interface WeChatProfile {
  openid: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export interface WeChatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * Custom WeChat OAuth provider for NextAuth v4.
 *
 * WeChat OAuth flow (PC QR code login):
 * 1. Redirect user to https://open.weixin.qq.com/connect/qrconnect
 * 2. User scans QR code on phone → WeChat redirects to callback URL with ?code=AUTH_CODE
 * 3. Exchange code for access_token via GET https://api.weixin.qq.com/sns/oauth2/access_token
 * 4. Fetch userinfo via GET https://api.weixin.qq.com/sns/userinfo?access_token=TOKEN&openid=OPENID
 *
 * NOTE: WeChat's token and userinfo endpoints use GET (not POST).
 * Both endpoints return { errcode, errmsg } on failure.
 */
export default function WeChatProvider<P extends WeChatProfile>(
  options: OAuthUserConfig<P>,
): OAuthConfig<P> {
  return {
    id: 'wechat',
    name: 'WeChat',
    type: 'oauth',
    version: '2.0',
    checks: ['state'],
    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect',
      params: {
        appid: options.clientId,
        response_type: 'code',
        scope: 'snsapi_login',
      },
    },
    token: {
      url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      async request({ provider, params }) {
        const url = new URL(
          'https://api.weixin.qq.com/sns/oauth2/access_token',
        );
        url.searchParams.set('appid', provider.clientId as string);
        url.searchParams.set('secret', provider.clientSecret as string);
        url.searchParams.set('code', params.code as string);
        url.searchParams.set('grant_type', 'authorization_code');

        const res = await fetch(url.toString());
        const data: WeChatTokenResponse = await res.json();

        if (data.errcode) {
          throw new Error(
            `WeChat OAuth token error ${data.errcode}: ${data.errmsg}`,
          );
        }

        return {
          tokens: {
            access_token: data.access_token,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token,
            openid: data.openid,
            unionid: data.unionid,
          },
        };
      },
    },
    userinfo: {
      url: 'https://api.weixin.qq.com/sns/userinfo',
      async request({ tokens }) {
        const url = new URL('https://api.weixin.qq.com/sns/userinfo');
        url.searchParams.set('access_token', tokens.access_token as string);
        url.searchParams.set('openid', tokens.openid as string);

        const res = await fetch(url.toString());
        const data: Record<string, unknown> = await res.json();

        if (data.errcode) {
          throw new Error(
            `WeChat userinfo error ${String(data.errcode)}: ${String(data.errmsg)}`,
          );
        }

        return {
          sub: String(data.openid ?? ''),
          name: String(data.nickname ?? 'WeChat User'),
          image: data.headimgurl ? String(data.headimgurl) : undefined,
          // Pass through raw WeChat fields for the profile callback
          openid: String(data.openid ?? ''),
          nickname: data.nickname ? String(data.nickname) : undefined,
          headimgurl: data.headimgurl ? String(data.headimgurl) : undefined,
          unionid: data.unionid ? String(data.unionid) : undefined,
          sex: data.sex ? Number(data.sex) : undefined,
        };
      },
    },
    profile(profile) {
      return {
        id: String(profile.openid ?? ''),
        name: String(profile.nickname ?? 'WeChat User'),
        email: null,
        image: profile.headimgurl
          ? String(profile.headimgurl)
          : undefined,
      };
    },
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    style: {
      logo: '/wechat-logo.svg',
      bg: '#07C160',
      text: '#fff',
    },
  };
}
