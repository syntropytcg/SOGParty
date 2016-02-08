[![Build Status Travis](https://travis-ci.org/CounterpartyXCP/counterwallet.svg?branch=develop)](https://travis-ci.org/CounterpartyXCP/counterwallet)
[![Build Status Circle](https://circleci.com/gh/CounterpartyXCP/counterwallet.svg?&style=shield)](https://circleci.com/gh/CounterpartyXCP/counterwallet)


SoGParty
================

- This is a project forking counterwallet and adapting it specifically for Spells of Genesis gaming assets. This project is going to be entered into the DEVPARTY contest, please vote for it!

- Note #1: SOGPARTY requires my **[forked Counterblock server](https://github.com/x-ETHeREAL-x/SOGPartyBlock)** to enable BITCRYSTALS denominatted markets to work. These markets must give priority to BITCRYSTALS as a quote asset like XCP/BTC over the cards. Without this change the BCY markets trade denomated in the card assets and require awkward decimal approximations that induce rounding errors. 

- Note #2: SOGPARTY's ShapeShift.io integration requires  my **[forked ShapeShift Skeleton](https://github.com/x-ETHeREAL-x/ShapeShift-Skeleton)** to enable ShapeShift functionality in the wallet. 

Devparty Contest 
-------------------

Please vote for SOGParty.com in the **[Devparty Development Contest!](http://counterparty.io/devparty/)**


Beta Testing System
-------------------

* Primary server -- Mainnet: **[SoGParty.com/BETA](https://sogparty.com/BETA)**


SOG-Specific DEX and Wallet Features
----------

- Asset limitation; only SOG card assets and BTC/BCY/XCP displayed
- Standard high bid - low ask style market discovery
- Card image associates with markets and wallet
- Balances sort fixed with currencies (BTC, BCY, XCP) first with images
- Non-focus on XCP currency, improved discovery of BTC/BCY markets
- Streamlined UI 
- Homepage display of trending markets



Included Standard Counterwallet Features
----------

- Deterministic wallet addresses (BIP 32-based)
- Supports the majority of Counterparty functionality
- Fully-AJAX driven
- Anonymous
- Runs in the browser, with keys created in memory
- Multi-sig

Browser Support
-------------------

**Desktop**

- Chrome 23+ (preferred browser)
- Firefox 25+
- Safari 7+
- Opera 15+

Notably, Internet Explorer is **not** supported, due to its lack of full Content-Security-Policy support (even with IE 11).

**Mobile (Not Tested Yet!)** 

- IOS Safari 7+
- Android Browser 4.4+
- Chrome for Android 33+
- Chrome for iOS 35+
- Firefox for Android 26+



Licence
-------------------

http://opensource.org/licenses/CDDL-1.0

