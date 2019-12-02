import _ from 'lodash'
import { createSelector } from 'reselect'
import { getIndexerGetLocators } from './callDataSelectors'
import {
  getIndexSetLocatorEvents,
  getIndexSetLocatorHistoricalFetchStatus,
} from '../../index/redux/eventTrackingSelectors'
import { mapOnChainIntentToOffChain, parseLocatorAndLocatorType } from '../utils'
import { getIndexerCreateIndexEvents, getIndexerCreateIndexHistoricalFetchStatus } from './eventTrackingSelectors'
import { getDelegates } from '../../delegateFactory/redux/selectors'
import { getDelegateFactoryCreateDelegateHistoricalFetchStatus } from '../../delegateFactory/redux/eventTrackingSelectors'

// TODO: this selector is a work in progress, currently being replaced by the selector below which is event driven instead of callData driven
const getLocators = createSelector(getIndexerGetLocators, responses =>
  responses.map(r => {
    const {
      parameters: { senderToken, signerToken },
      response, //eslint-disable-line
    } = r
    const [, ...rest] = r.split(',').reverse()
    const length = rest.length / 2
    rest.slice(0, length).map(locator => ({
      senderToken,
      signerToken,
      ...locator,
    }))
  }),
)

const getIndexes = createSelector(getIndexerCreateIndexEvents, events =>
  _.uniqBy(
    events.map(
      ({ values: { senderToken, signerToken, indexAddress } }) => ({
        senderToken,
        signerToken,
        indexAddress,
      }),
      v => JSON.stringify(v, ['senderToken', 'signerToken', 'indexAddress']),
    ),
  ),
)

const getIndexAddresses = createSelector(getIndexes, indexes => indexes.map(({ indexAddress }) => indexAddress))

const getLocatorIntents = createSelector(
  getIndexSetLocatorEvents,
  getIndexes,
  getDelegates,
  (setLocatorEvents, indexes, delegates) => {
    const parsedEvents = setLocatorEvents.map(event => {
      const {
        values: { identifier, locator: unformattedLocator, score },
        address: indexAddress,
        blockNumber,
      } = event

      const { senderToken, signerToken } = _.find(indexes, { indexAddress }) || {}

      if (!(senderToken && signerToken)) {
        return null
      }
      const { locator, locatorType } = parseLocatorAndLocatorType(unformattedLocator, identifier)

      let delegateTradeWallet

      if (locatorType === 'contract') {
        const delegate = _.find(delegates, { delegateContract: locator })
        if (!delegate) {
          return null
        }
        delegateTradeWallet = delegate.delegateTradeWallet
      }

      return {
        senderToken,
        signerToken,
        indexAddress,
        identifier,
        tradeWallet: delegateTradeWallet,
        locator,
        locatorType,
        score,
        blockNumber,
      }
    })
    const uniqueLocators = _.reduce(
      _.compact(parsedEvents),
      (agg, val) => {
        const existingLocator = _.find(agg, { indexAddress: val.indexAddress, identifier: val.identifier })
        if (!existingLocator) {
          return [...agg, val]
        } else if (existingLocator.blockNumber < val.blockNumber) {
          const existingLocatorIndex = _.findIndex(agg, { indexAddress: val.indexAddress, identifier: val.identifier })
          return [...agg.slice(0, existingLocatorIndex), val, ...agg.slice(existingLocatorIndex + 1)]
        }
        return agg
      },
      [],
    )
    return _.sortBy(uniqueLocators, 'score').reverse()
  },
)

const getLocatorIntentsFormatted = createSelector(getLocatorIntents, intents => intents.map(mapOnChainIntentToOffChain))

// This selector falsely claims to return "makerAddresses" that are "connected":
// - they are not connected because there is currently no efficient way to determine if a off-chain maker is online
// - the makerAddress values aren't maker addresses, they are "identifiers"
// there's no way to get the data I need, but I need to provide these values or things like the token dropdown in instant will break
const getConnectedOnChainMakerAddresses = createSelector(getLocatorIntentsFormatted, intents =>
  intents.map(({ makerAddress }) => makerAddress),
)

const getContractLocatorIntentsFormatted = createSelector(getLocatorIntentsFormatted, intents =>
  _.filter(intents, { locatorType: 'contract' }),
)

const getIndexerIntentsLoaded = createSelector(
  getIndexerCreateIndexHistoricalFetchStatus,
  getIndexSetLocatorHistoricalFetchStatus,
  getDelegateFactoryCreateDelegateHistoricalFetchStatus,
  (createIndex, setLocator, createDelegate) => createIndex.fetched && setLocator.fetched && createDelegate.fetched,
)

export {
  getLocators,
  getLocatorIntents,
  getLocatorIntentsFormatted,
  getContractLocatorIntentsFormatted,
  getConnectedOnChainMakerAddresses,
  getIndexes,
  getIndexAddresses,
  getIndexerIntentsLoaded,
}