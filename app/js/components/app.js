import { h, Component } from 'preact';

import UploadImageComponent from './upload-image-component';
import ComposeCaptionComponent from './compose-caption-component';
import HashtagsComponent from './hashtags-component';

import { me, upload, hashtags } from '../helper';

export default class App extends Component {
  constructor() {
    super();

    this.state = {
      loading: false,
      username: me.username,
      caption: '',
      image: ''
    };
  }

  _handleUploadClick() {
    this.setState({loading: true});
    let that = this;

    upload( this.state.image, this.state.caption )
    .then(function(params) {
      console.info('done', params);
      that.setState({loading: false});
    }).catch(function(error) {
      console.log(error);
      that.setState({loading: false});
    });
  }

  _handleCancelClick() {
    location.reload();
  }

  onChange( state ) {
    this.setState( state );
  }

  render({},{ username, loading }) {
    return (
      <div id="upload">
        
        <div class="header">
          <h1>Instaploader of {username}</h1>
        </div>

        <div class="content">
          <div class="column">
            <UploadImageComponent onChange={this.onChange.bind(this)} />
          </div>
          <div class="column">
            <ComposeCaptionComponent onChange={this.onChange.bind(this)} />
            <HashtagsComponent hashtags={hashtags}/>
          </div>
        </div>

        <div class="submit">

          <button
            class={{'primary-btn': true, 'is-loading': loading}}
            onClick={this._handleUploadClick.bind(this)}
          >
            Upload
            <svg class="spinner" width="65px" height="65px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
              <circle class="path" fill="none" stroke-width="6" stroke-linecap="round" cx="33" cy="33" r="30"></circle>
            </svg>
          </button>

          <button
            class='secondary-btn'
            onClick={this._handleCancelClick.bind(this)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
}
