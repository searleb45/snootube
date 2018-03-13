'use strict';

var snootubeInstance;

class SnooTubeMaterial {
  constructor() {
    let self = this;
    ContentRenderer.init();
    self.redditAccessor = new RedditLoader(this);

    window.addEventListener('message', (msg) => {
      if( msg.data.type === 'RETRY_LOAD' ) {
        self.findPostsForVideo( YoutubeData.getVideoId() );
      }
    })
    self.removeExistingComments(() => {
      self.findPostsForVideo( YoutubeData.getVideoId() );
    });
  }

  removeExistingComments(cb) {
    let observer = new MutationObserver((mutations) => {
      if( document.getElementById('comments') ) {
        let ytComments = document.getElementById('comments');
        let newComments = document.createElement('div');
        newComments.id = 'comments';
        newComments.className = 'ytd-watch snootube-container';
        ytComments.replaceWith(newComments);
        observer.disconnect();
        if( typeof(cb) === 'function' ) {
          cb();
        }
      }
    });
    observer.observe(document.querySelector('body'), {childList: true, subtree: true});
  }

  showLoadingScreen() {
    if( !this.loadingDiv ) {
      let loadingDiv = document.createElement('div'),
          loader = document.createElement('div');
      loadingDiv.id = 'comments';
      loadingDiv.className = 'style-scope ytd-watch';
      loader.className = 'snoo-loader';
      loadingDiv.appendChild( loader );
      this.loadingDiv = loadingDiv;
    }
    document.getElementById('main').appendChild( this.loadingDiv );
  }

  hideLoadingScreen() {
    document.getElementById('main').removeChild( this.loadingDiv );
  }

  showNoResults() {
    let nrContainer = document.createElement( 'div' );
    nrContainer.id = 'snooNoResultsFound';
    nrContainer.className = 'style-scope ytd-watch';
    nrContainer.innerHTML = `<h3>No results found for this URL</h3>`;

    let retryButton = document.createElement('button');
    retryButton.className = 'snoo-retry-button';
    retryButton.addEventListener( 'click', () => window.postMessage({ type: "RETRY_LOAD" }, '*') );
    nrContainer.appendChild( retryButton );
    document.getElementById('comments').parentNode.replaceChild(nrContainer, document.getElementById('comments'));

    this.hideLoadingScreen();
  }

  async findPostsForVideo( vidId ) {
    this.showLoadingScreen();

    let posts = await this.redditAccessor.searchForPosts( vidId );
    this.showThreadResults(posts);
  }

  async findCommentsForPost( post, postId ) {
    this.showLoadingScreen();

    let comments = await this.redditAccessor.getCommentsForPost(post.subreddit, post.id);
    console.log(comments);
    let commentFragment = await ContentRenderer.renderComments(comments);
    document.getElementById(postId).appendChild(commentFragment);
    console.log('comments rendered');
    this.hideLoadingScreen();
  }

  appendTabs( tabList, tabContainer ) {
    // Sort posts by number of upvotes
    tabList.sort((a,b) => parseInt(b.getAttribute('score').replace(/,/g, '')) - parseInt(a.getAttribute('score').replace(/,/g, '')));

    // Filter duplicate posts in one subreddit
    let subs = [];
    for( let i=0; i<tabList.length; i++ ) {
      let el = tabList[i];
      if( !subs.includes(el.dataset.sub) ) {
        subs.push(el.dataset.sub);
      } else {
        tabList.splice(i--, 1);
      }
    }

    // If number of threads greater than 4, add dropdown element with subchildren
    if( tabList.length > 4 ) {
      tabList.push( ContentRenderer.generateTabDropdown(tabList.splice(4)) );
    }
    tabList.forEach((el) => tabContainer.appendChild(el));
  }

  async showThreadResults( threadList ) {
    let tabContainer = document.createElement('div'),
        threadContainer = document.createElement('div');
    tabContainer.className = 'snoo-tabs';
    threadContainer.className = 'snoo-threads';

    document.getElementById('comments').appendChild( tabContainer )
    document.getElementById('comments').appendChild( threadContainer );
    let tabList = [];
    await Promise.all(threadList.map(async (item) => {
      if( item.data.url.match(YoutubeData.getVideoId()) && item.data.score > 0 && item.data.num_comments > 0 ) {
        item.data.score = item.data.score.toLocaleString();
        let tab = await ContentRenderer.renderTab( item.data );
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('.snootube-post-body').forEach((el) => el.classList.remove('visible'));
          document.querySelectorAll('.snootube-tab').forEach((el) => el.classList.remove('active'));
          document.getElementById(e.target.dataset.id).classList.add('visible');
          this.findCommentsForPost(item.data, e.target.dataset.id);
          e.target.classList.add('active');
        });
        tabList.push(tab);

        item.data.post_time = ContentRenderer.getDateStringFromTimestamp(item.data.created_utc);
        let thread = await ContentRenderer.renderPost( item.data );
        threadContainer.appendChild(thread);
      }
    }));

    this.appendTabs(tabList, tabContainer);


    this.hideLoadingScreen();
    document.querySelector('.snootube-tab').click();
    tabContainer.classList.add('visible');
    threadContainer.classList.add('visible');
  }
}

class SnooTube_Old {
  constructor() {
    console.log("Not material Youtube");
  }
}

class ContentRenderer {
  static async init() {
    ContentRenderer.tabTemplate = await this._loadTemplate('snootubeTabTemplate');
    ContentRenderer.postTemplate = await this._loadTemplate('snootubeMainPostTemplate');
    ContentRenderer.commentTemplate = await this._loadTemplate('snootubeCommentTemplate');
  }

  static async _loadTemplate( templateName ) {
    let response = await fetch(chrome.extension.getURL(`/templates/${templateName}.html`), {mode: 'cors'});

    if( response.status === 200 ) {
      let template = await response.text();
      return template;
    }
  }

  static async renderTab( redditResult ) {
    ContentRenderer.tabTemplate = ContentRenderer.tabTemplate || await this._loadTemplate('snootubeTabTemplate');
    console.log(redditResult);
    return this._templatize(ContentRenderer.tabTemplate, redditResult);
  }

  static async renderPost( redditResult ) {
    ContentRenderer.postTemplate = ContentRenderer.postTemplate || await this._loadTemplate('snootubeMainPostTemplate');
    return this._templatize(ContentRenderer.postTemplate, redditResult);
  }

  static async renderComments( commentList ) {
    ContentRenderer.commentTemplate = ContentRenderer.commentTemplate || await this._loadTemplate('snootubeCommentTemplate');
    let commentFragment = document.createDocumentFragment();

    for(let i=0; i<commentList.length; i++) {
      let comment = commentList[i];

      if( comment.kind === 't1' ) {
        let commentElement = this._templatize(ContentRenderer.commentTemplate, comment.data);
        if( comment.data.replies && comment.data.replies.kind === 'Listing' && comment.data.replies.data.children ) {
          commentElement.querySelector('.comments').appendChild( await this.renderComments(comment.data.replies.data.children) );
        }
        commentFragment.appendChild(commentElement);
      }
    }
    return commentFragment;
  }

  static generateTabDropdown( elements ) {
    let dropdownContainer = document.createElement('div'),
        dropdownList = document.createElement('ul');

    // Setup for dropdown container
    dropdownContainer.className = 'snootube-tab snoo-dropdown';

    // Setup for dropdown list
    dropdownList.className = 'snoo-dropdown-container';

    dropdownList.addEventListener('click', function(e) {
      // Delegate event to swap selected dropdown elements into the top bar
      if(e.target && e.target.nodeName === 'BUTTON' && e.target.classList.contains('snootube-tab')) {
        let toSwap = document.querySelector('.snoo-tabs > .snootube-tab:not(.snoo-dropdown):last-of-type'),
            newLocation = e.target.parentElement;
        e.target.remove();
        toSwap.replaceWith(e.target);
        newLocation.appendChild(toSwap);
      }
    });

    for( let i=0; i<elements.length; i++ ) {
      let listItem = document.createElement('li');
      listItem.appendChild(elements[i]);
      dropdownList.appendChild(listItem);
    }

    // Append elements together and return
    dropdownContainer.appendChild(dropdownList);

    return dropdownContainer;
  }

  static getDateStringFromTimestamp( timestamp ) {
    // Diff in ms
    let diff = Date.now() - (timestamp * 1000);
    if( diff < 1000 ) {
      return 'just now';
    }
    // Diff in seconds
    diff /= 1000;
    if( diff < 60 ) {
      return `${parseInt(diff)} second${parseInt(diff)!==1?'s':''} ago`;
    }
    // Diff in minutes
    diff /= 60;
    if( diff < 60 ) {
      return `${parseInt(diff)} minute${parseInt(diff)!==1?'s':''} ago`;
    }
    // Diff in hours
    diff /= 60;
    if( diff < 24 ) {
      return `${parseInt(diff)} hour${parseInt(diff)!==1?'s':''} ago`;
    }
    // Diff in days
    diff /= 24;
    if( diff < 7 ) {
      return `${parseInt(diff)} day${parseInt(diff)!==1?'s':''} ago`;
    }
    // Diff in weeks
    diff /= 7;
    if( diff < 4 ) {
      return `${parseInt(diff)} week${parseInt(diff)!==1?'s':''} ago`;
    }
    // Diff in months
    diff /= 4;
    if( diff < 13 ) {
      return `${parseInt(diff)} month${parseInt(diff)!==1?'s':''} ago`;
    }
    // Diff in years
    diff /= 12;
    if( diff < 7 ) {
      return `${parseInt(diff)} year${parseInt(diff)!==1?'s':''} ago`;
    }

    return new Date(timestamp * 1000).toLocaleString();
  }

  static _templatize( templateString, data ) {
    let temp = document.createElement('div');
    temp.innerHTML = mustache(templateString, data);
    return temp.firstChild;
  }
}

class RedditLoader {
  constructor( snootubeInstance ) {
    this.snootube = snootubeInstance;
  }

  async searchForPosts( vidId ) {
    let query = `(url:${vidId}) (site:youtube.com OR site:youtu.be)`;

    let result = await fetch( 'https://api.reddit.com/search.json?q=' + query, {mode: 'cors'} );

    if( result.status === 200 ) {
     let json = await result.json();
     if( json && json.kind === 'Listing' && json.data.children.length > 0 ) {
       return json.data.children;
     }
    }

    this.snootube.showNoResults();
  }

  async getCommentsForPost( subreddit, postId ) {
    let postUrl = `https://api.reddit.com/r/${subreddit}/comments/${postId}.json`;

    let result = await fetch( postUrl, {mode: 'cors'} );

    if( result.status === 200 ) {
      let json = await result.json();

      if( json && json[1] && json[1].kind === 'Listing' && json[1].data && json[1].data.children.length ) {
        return json[1].data.children;
      }
    }
    this.snootube.showCouldNotFetchPost();
  }
}

class YoutubeData {
  static isVideoPage() {
    return window.location.pathname.match('watch');
  }

  static isMaterialYoutube() {
    return document.querySelector('ytd-app') !== null;
  }

  static getVideoId() {
    if( this.vidId ) return this.vidId;
    let queryString = window.location.search.substr(1);
    let requestObjects = queryString.split('&');
    for (let i = 0, len = requestObjects.length; i < len; i += 1) {
        let obj = requestObjects[i].split('=');
        if (obj[0] === "v") {
            this.vidId = obj[1];
            return obj[1];
        }
    }
  }
}

function init() {
  console.log("SnooTube initialized!");

  if( YoutubeData.isVideoPage() ) {
    if( YoutubeData.isMaterialYoutube() ) {
      snootubeInstance = new SnooTubeMaterial();
    } else {
      snootubeInstance = new SnooTube_Old();
    }
  } else {
    console.log('is not video page');
  }
}

if( document.readyState === "complete" || document.readyState === "interactive" ) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, false);
}